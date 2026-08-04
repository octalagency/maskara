-- Maskara Own Dialer IVR: play hosted Chirp3 MP3, gather DTMF, webhook Maskara API
local session = session
if not session then return end

session:answer()
session:sleep(400)

local call_id = session:getVariable("maskara_call_id") or "unknown"
local prompt_url = session:getVariable("maskara_prompt_url") or ""
local confirm_url = session:getVariable("maskara_confirm_url") or ""
local cancel_url = session:getVariable("maskara_cancel_url") or ""
local invalid_url = session:getVariable("maskara_invalid_url") or ""
local webhook = session:getVariable("maskara_webhook") or ""

local audio_dir = "/var/lib/freeswitch/maskara-audio"
os.execute("mkdir -p " .. audio_dir)

local api = freeswitch.API()

local function download(url, name)
  if not url or url == "" then return nil end
  local path = audio_dir .. "/" .. call_id .. "-" .. name .. ".mp3"
  -- mod_curl: "<url> get <file> ..."
  local cmd = string.format(
    "%s get %s connect-timeout 30 timeout 30",
    url,
    path
  )
  local res = api:execute("curl", cmd) or ""
  local f = io.open(path, "rb")
  if f then
    local size = f:seek("end")
    f:close()
    if size and size > 0 then
      return path
    end
  end
  freeswitch.consoleLog(
    "ERR",
    "[maskara] download failed " .. name .. " url=" .. url .. " res=" .. res .. "\n"
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

local function notify(digits)
  if webhook == "" then return end
  local payload = string.format(
    '{"call_id":%q,"digits":%q,"provider":"maskara_dialer"}',
    call_id,
    digits
  )
  -- fire-and-forget HTTP POST via mod_curl
  local cmd = string.format(
    "%s post content-type 'application/json' connect-timeout 15 timeout 15 data '%s'",
    webhook,
    payload:gsub("'", "")
  )
  api:execute("curl", cmd)
end

local function play(path)
  if path then session:execute("playback", path) end
end

for attempt = 1, 3 do
  play(prompt)
  local digits = session:playAndGetDigits(
    1, 1, 1, 8000, "#",
    prompt,
    invalid or prompt,
    "\\d",
    "maskara_digit",
    3000
  )
  digits = digits or session:getVariable("maskara_digit") or ""

  if digits == "0" then
    -- replay
  elseif digits == "1" then
    play(confirm)
    notify("1")
    session:hangup()
    return
  elseif digits == "2" then
    play(cancel)
    notify("2")
    session:hangup()
    return
  else
    play(invalid)
    notify(digits ~= "" and digits or "invalid")
  end
end

session:hangup()
