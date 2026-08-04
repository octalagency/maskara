# Maskara Own Dialer (ManyDial-style)

Maskara owns the **voice media** (Google Chirp3 Leda / Algieba MP3). FreeSWITCH dials out over a Bangladesh **096 SIP trunk**. ePBX portal TTS is not used.

## Architecture

1. Order arrives → Maskara synths Chirp3 MP3 → hosts at `/voice/tts-audio/:id`
2. Backend ESL → FreeSWITCH `originate` via SIP gateway
3. FreeSWITCH downloads MP3, plays it, gathers DTMF 1/2/0
4. Webhook `POST /voice/webhook/maskara-dialer/dtmf` → same confirm/cancel pipeline as ePBX

## Where to get a number

Bangladesh outbound must use a BTRC-approved **096 IPTSP DID** (not a personal 017).

| Source | How |
|--------|-----|
| ePBX workspace | Portal → Extensions / SIP Trunks → copy SIP host, user, password for DID `096…` (dial-only / BYOC) |
| AmberIT / BTCL / BDCOM | Buy 096 IP telephony, get SIP trunk credentials |
| Other IPTSP | Same: SIP host + auth + caller ID |

## Env (VPS `/opt/maskara/.env`)

```env
VOICE_PROVIDER=maskara_dialer
# or VOICE_PROVIDER=auto  (uses dialer when SIP_* set)

SIP_TRUNK_HOST=sip.your-iptsp.example
SIP_TRUNK_USER=your_sip_user
SIP_TRUNK_PASSWORD=your_sip_password
SIP_TRUNK_CALLER_ID=09639444146
SIP_GATEWAY_NAME=maskara_trunk
FREESWITCH_ESL_HOST=freeswitch
FREESWITCH_ESL_PASSWORD=ClueCon
GOOGLE_TTS_API_KEY=...
```

Then recreate FreeSWITCH so the SIP gateway XML is written:

```bash
cd /opt/maskara
docker compose -f docker-compose.hostinger.yml up -d --force-recreate freeswitch backend worker
docker exec maskara-freeswitch fs_cli -x "sofia status gateway maskara_trunk"
```

### Go-live checklist (prod)

1. FreeSWITCH `healthy`, ESL from backend OK (`maskara_esl` ACL), `mod_shout` loaded (MP3).
2. Prefer **ePBX extension** SIP (e.g. `201@maskara.epbx.bd`) — ICC trunk direct REGISTER often returns `503` from VPS IPs.
3. Set `SIP_TRUNK_*` + Admin/DB `provider=maskara_dialer` (DB overrides `.env`).
4. `sofia status gateway maskara_trunk` → **REGED / UP**.
5. Admin test call with Settings voice **Leda** → answer phone → hear Chirp3.
6. Nginx shows `GET /voice/tts-audio/*` with `User-Agent` **Wget** after answer.

## Admin

`/admin/config` → **Maskara Own Dialer** — save SIP fields, set provider to `maskara_dialer`, Test Call with Leda.

## Verify Leda is live

1. Settings → AI voice → **Leda**
2. Admin Test Call to your phone
3. Voice must match Maskara preview (Chirp3 Leda)
4. On VPS: `docker logs maskara-nginx --since 5m | grep tts-audio` — FreeSWITCH must GET the MP3

## Fallback

If SIP is empty, `VOICE_PROVIDER=auto` falls back to ePBX (legacy portal voice).
