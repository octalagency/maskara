#!/bin/sh
set -eu

# Bootstrap vanilla FreeSWITCH config (same as safarov image) if missing
if [ ! -f /etc/freeswitch/freeswitch.xml ]; then
  mkdir -p /etc/freeswitch
  cp -a /usr/share/freeswitch/conf/vanilla/. /etc/freeswitch/
  echo "[maskara-dialer] Bootstrapped vanilla FreeSWITCH config"
fi

# Ensure Maskara dialplan + lua always present (volume may wipe /etc/freeswitch)
mkdir -p /etc/freeswitch/dialplan/public \
         /etc/freeswitch/sip_profiles/external \
         /usr/share/freeswitch/scripts/maskara \
         /var/lib/freeswitch/maskara-audio

if [ -f /usr/share/freeswitch/conf/vanilla/dialplan/public/00_maskara_verify.xml ]; then
  cp -f /usr/share/freeswitch/conf/vanilla/dialplan/public/00_maskara_verify.xml \
    /etc/freeswitch/dialplan/public/00_maskara_verify.xml
fi
if [ -f /usr/share/freeswitch/conf/vanilla/autoload_configs/event_socket.conf.xml ]; then
  cp -f /usr/share/freeswitch/conf/vanilla/autoload_configs/event_socket.conf.xml \
    /etc/freeswitch/autoload_configs/event_socket.conf.xml
fi

GATEWAY_NAME="${SIP_GATEWAY_NAME:-maskara_trunk}"
SIP_HOST="${SIP_TRUNK_HOST:-}"
SIP_USER="${SIP_TRUNK_USER:-}"
SIP_PASS="${SIP_TRUNK_PASSWORD:-}"
SIP_PROXY="${SIP_TRUNK_PROXY:-$SIP_HOST}"
SIP_REALM="${SIP_TRUNK_REALM:-$SIP_HOST}"
SIP_REGISTER="${SIP_TRUNK_REGISTER:-true}"
ESL_PASSWORD="${FREESWITCH_ESL_PASSWORD:-ClueCon}"
CALLER_ID="${SIP_TRUNK_CALLER_ID:-09639444146}"

if [ -f /etc/freeswitch/autoload_configs/event_socket.conf.xml ]; then
  # listen on all interfaces for docker ESL
  sed -i 's/value="::1"/value="0.0.0.0"/g' /etc/freeswitch/autoload_configs/event_socket.conf.xml || true
  sed -i 's/value="127.0.0.1"/value="0.0.0.0"/g' /etc/freeswitch/autoload_configs/event_socket.conf.xml || true
  sed -i "s|__ESL_PASSWORD__|${ESL_PASSWORD}|g" /etc/freeswitch/autoload_configs/event_socket.conf.xml || true
  # if stock password ClueCon, keep; also force password param
  sed -i "s|<param name=\"password\" value=\".*\"/>|<param name=\"password\" value=\"${ESL_PASSWORD}\"/>|" \
    /etc/freeswitch/autoload_configs/event_socket.conf.xml || true
fi

GATEWAY_FILE="/etc/freeswitch/sip_profiles/external/${GATEWAY_NAME}.xml"
if [ -n "$SIP_HOST" ] && [ -n "$SIP_USER" ]; then
  cat > "$GATEWAY_FILE" <<EOF
<include>
  <gateway name="${GATEWAY_NAME}">
    <param name="username" value="${SIP_USER}"/>
    <param name="password" value="${SIP_PASS}"/>
    <param name="realm" value="${SIP_REALM}"/>
    <param name="proxy" value="${SIP_PROXY}"/>
    <param name="register" value="${SIP_REGISTER}"/>
    <param name="caller-id-in-from" value="true"/>
    <param name="extension" value="${CALLER_ID}"/>
    <param name="from-user" value="${SIP_USER}"/>
    <param name="from-domain" value="${SIP_REALM}"/>
    <param name="expire-seconds" value="3600"/>
    <param name="retry-seconds" value="30"/>
    <param name="context" value="public"/>
  </gateway>
</include>
EOF
  echo "[maskara-dialer] SIP gateway ${GATEWAY_NAME} → ${SIP_HOST} (caller ${CALLER_ID})"
else
  rm -f "$GATEWAY_FILE"
  echo "[maskara-dialer] SIP trunk not configured (set SIP_TRUNK_HOST + SIP_TRUNK_USER)"
fi

# Run FreeSWITCH like stock image (foreground)
exec /usr/bin/freeswitch -nc -nf -nonat
