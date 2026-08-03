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

local function download(url, name)
  if not url or url == "" then return nil end
  local path = audio_dir .. "/" .. call_id .. "-" .. name .. ".mp3"
  -- quote-safe: strip characters that break shell
  url = url:gsub("[;&|`$]", "")
  local cmd = string.format("curl -fsSL --max-time 30 -o %s %q", path, url)
  local ok = os.execute(cmd)
  if ok == true or ok == 0 then
    return path
  end
  freeswitch.consoleLog("ERR", "[maskara] download failed " .. name .. " url=" .. url .. "\n")
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
  local tmp = audio_dir .. "/" .. call_id .. "-dtmf.json"
  local f = io.open(tmp, "w")
  if f then
    f:write(payload)
    f:close()
  end
  local wh = webhook:gsub("[;&|`$]", "")
  os.execute(string.format(
    "curl -fsS -X POST -H 'Content-Type: application/json' --data-binary @%s --max-time 15 %q >/dev/null 2>&1 &",
    tmp,
    wh
  ))
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
