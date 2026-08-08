-- Maskara Own Dialer IVR: play Chirp3 MP3 once, gather DTMF 1/2/0, webhook API
local session = session
if not session then return end

-- Outbound leg is already answered by customer — do not re-answer
session:sleep(300)

local call_id = session:getVariable("maskara_call_id") or "unknown"
local prompt_url = session:getVariable("maskara_prompt_url") or ""
local confirm_url = session:getVariable("maskara_confirm_url") or ""
local cancel_url = session:getVariable("maskara_cancel_url") or ""
local invalid_url = session:getVariable("maskara_invalid_url") or ""
local webhook = session:getVariable("maskara_webhook") or ""

local audio_dir = "/var/lib/freeswitch/maskara-audio"
os.execute("mkdir -p " .. audio_dir)

local function shell_quote(s)
  return "'" .. tostring(s):gsub("'", "'\\''") .. "'"
end

-- Cache by URL filename (Nest TTS id). Avoids wget fork-storm that exhausts
-- container PIDs and leaves FreeSWITCH permanently unhealthy overnight.
local function cache_key(url, name)
  local id = tostring(url or ""):match("([^/?#]+)$") or name
  id = id:gsub("[^%w%._%-]", "_")
  if #id < 4 then id = name .. "-" .. tostring(call_id) end
  return id
end

local function download(url, name)
  if not url or url == "" then return nil end
  local key = cache_key(url, name)
  local path = audio_dir .. "/" .. key .. ".mp3"
  local f = io.open(path, "rb")
  if f then
    local size = f:seek("end")
    f:close()
    if size and size > 512 then
      return path
    end
  end
  url = url:gsub("[;&|`$\\]", "")
  -- BusyBox wget; one fork per miss only
  local cmd = string.format(
    "wget -q -O %s %s",
    shell_quote(path),
    shell_quote(url)
  )
  local ok = os.execute(cmd)
  f = io.open(path, "rb")
  if f then
    local size = f:seek("end")
    f:close()
    if size and size > 512 and (ok == true or ok == 0) then
      return path
    end
  end
  freeswitch.consoleLog(
    "ERR",
    "[maskara] download failed " .. name .. " url=" .. tostring(url) .. "\n"
  )
  return nil
end

local prompt = download(prompt_url, "prompt")
local confirm = download(confirm_url, "confirm")
local cancel = download(cancel_url, "cancel")
local invalid = download(invalid_url, "invalid")

if not prompt then
  freeswitch.consoleLog("ERR", "[maskara] missing prompt audio call_id=" .. call_id .. "\n")
  session:hangup("NORMAL_TEMPORARY_FAILURE")
  return
end

-- Synchronous webhook so Nest gets DTMF before hangup status race
local function notify(digits)
  if webhook == "" then return end
  local payload = string.format(
    '{"call_id":%q,"digits":%q,"provider":"maskara_dialer"}',
    call_id,
    digits
  )
  local tmp = audio_dir .. "/" .. tostring(call_id):gsub("[^%w%-_]", "_") .. "-dtmf.json"
  local f = io.open(tmp, "w")
  if f then
    f:write(payload)
    f:close()
  end
  local wh = webhook:gsub("[;&|`$\\]", "")
  os.execute(string.format(
    "wget -q -O /dev/null --header=%s --post-file=%s %s",
    shell_quote("Content-Type: application/json"),
    shell_quote(tmp),
    shell_quote(wh)
  ))
end

local function play(path)
  if path then session:execute("playback", path) end
end

-- Single gather loop: do NOT play prompt before playAndGetDigits
local digits = session:playAndGetDigits(
  1,              -- min
  1,              -- max
  3,              -- tries
  12000,          -- timeout between prompts (ms)
  "#",            -- terminators
  prompt,         -- prompt file
  invalid or prompt,
  "^[012]$",      -- only 0/1/2
  "maskara_digit",
  5000            -- digit timeout
)
digits = tostring(digits or session:getVariable("maskara_digit") or "")

freeswitch.consoleLog(
  "INFO",
  "[maskara] dtmf call_id=" .. call_id .. " digits=" .. digits .. "\n"
)

if digits == "1" then
  session:setVariable("maskara_ivr_done", "true")
  notify("1")
  play(confirm)
  session:hangup("NORMAL_CLEARING")
  return
elseif digits == "2" then
  session:setVariable("maskara_ivr_done", "true")
  notify("2")
  play(cancel)
  session:hangup("NORMAL_CLEARING")
  return
elseif digits == "0" then
  notify("0")
  local again = session:playAndGetDigits(
    1, 1, 2, 12000, "#",
    prompt,
    invalid or prompt,
    "^[12]$",
    "maskara_digit",
    5000
  )
  again = tostring(again or session:getVariable("maskara_digit") or "")
  if again == "1" then
    session:setVariable("maskara_ivr_done", "true")
    notify("1")
    play(confirm)
    session:hangup("NORMAL_CLEARING")
    return
  elseif again == "2" then
    session:setVariable("maskara_ivr_done", "true")
    notify("2")
    play(cancel)
    session:hangup("NORMAL_CLEARING")
    return
  end
end

session:setVariable("maskara_ivr_done", "true")
notify(digits ~= "" and digits or "timeout")
session:hangup("NORMAL_CLEARING")
