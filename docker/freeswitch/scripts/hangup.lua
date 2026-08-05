-- Hangup notifier for Maskara dialer (runs even when customer never answers)
local call_id = "unknown"
local cause = "UNKNOWN"
local webhook = ""
local ivr_done = false

if session then
  call_id = session:getVariable("maskara_call_id") or call_id
  cause = session:hangupCause() or session:getVariable("hangup_cause") or cause
  webhook = session:getVariable("maskara_status_webhook")
    or session:getVariable("maskara_webhook")
    or webhook
  ivr_done = session:getVariable("maskara_ivr_done") == "true"
end

if argv and argv[1] and argv[1] ~= "" then call_id = argv[1] end
if argv and argv[2] and argv[2] ~= "" then cause = argv[2] end
if argv and argv[3] and argv[3] ~= "" then webhook = argv[3] end

-- DTMF path already finalized the order — never send a late "failed" that
-- refunds callAttempts (UI showed 0/20 CONFIRMED).
if ivr_done then
  freeswitch.consoleLog(
    "INFO",
    "[maskara] hangup skip ivr_done call_id=" .. tostring(call_id) .. " cause=" .. tostring(cause) .. "\n"
  )
  return
end

if webhook == "" then
  freeswitch.consoleLog(
    "WARNING",
    "[maskara] hangup no webhook call_id=" .. tostring(call_id) .. " cause=" .. tostring(cause) .. "\n"
  )
  return
end

local function shell_quote(s)
  return "'" .. tostring(s):gsub("'", "'\\''") .. "'"
end

local status = "failed"
local c = string.upper(tostring(cause or ""))
if c == "" or c == "NONE" or c == "UNKNOWN" or c:find("NORMAL_CLEARING") then
  -- Answered / IVR ended — do not treat as SIP fail
  status = "completed"
elseif c:find("NO_ANSWER") or c:find("NO ANSWER") then
  status = "no-answer"
elseif c:find("USER_BUSY") or c:find("BUSY") then
  status = "busy"
elseif c:find("RECOVERY_ON_TIMER") or c:find("DESTINATION_OUT_OF_ORDER")
  or c:find("NORMAL_TEMPORARY_FAILURE") or c:find("NETWORK_OUT_OF_ORDER")
  or c:find("CALL_REJECTED") or c:find("REJECT") or c:find("UNALLOCATED")
  or c:find("ORIGINATOR_CANCEL") or c:find("TIMEOUT")
  or c:find("ALLOTTED_TIMEOUT") then
  status = "failed"
elseif c:find("NO_USER_RESPONSE") then
  status = "no-answer"
else
  status = "failed"
end

if status == "completed" then
  freeswitch.consoleLog(
    "INFO",
    "[maskara] hangup skip completed call_id=" .. tostring(call_id) .. " cause=" .. tostring(cause) .. "\n"
  )
  return
end

local payload = string.format(
  '{"call_id":%q,"status":%q,"provider":"maskara_dialer","hangup_cause":%q}',
  tostring(call_id),
  status,
  tostring(cause)
)
local audio_dir = "/var/lib/freeswitch/maskara-audio"
os.execute("mkdir -p " .. audio_dir)
local tmp = audio_dir .. "/" .. tostring(call_id):gsub("[^%w%-_]", "_") .. "-hangup.json"
local f = io.open(tmp, "w")
if f then
  f:write(payload)
  f:close()
end
local wh = tostring(webhook):gsub("[;&|`$\\]", "")
os.execute(string.format(
  "wget -q -O /dev/null --header=%s --post-file=%s %s >/dev/null 2>&1 &",
  shell_quote("Content-Type: application/json"),
  shell_quote(tmp),
  shell_quote(wh)
))
freeswitch.consoleLog(
  "INFO",
  "[maskara] hangup notify call_id=" .. tostring(call_id) .. " cause=" .. tostring(cause) .. " status=" .. status .. "\n"
)
