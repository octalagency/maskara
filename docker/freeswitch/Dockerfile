FROM safarov/freeswitch:latest

# Keep stock /docker-entrypoint.sh (bootstraps vanilla conf). Overlay Maskara pieces.
COPY conf/autoload_configs/event_socket.conf.xml /usr/share/freeswitch/conf/vanilla/autoload_configs/event_socket.conf.xml
COPY conf/dialplan/public/maskara_verify.xml /usr/share/freeswitch/conf/vanilla/dialplan/public/00_maskara_verify.xml
COPY scripts/verify.lua /usr/share/freeswitch/scripts/maskara/verify.lua
COPY maskara-entrypoint.sh /maskara-entrypoint.sh

RUN chmod +x /maskara-entrypoint.sh \
  && mkdir -p /usr/share/freeswitch/scripts/maskara \
             /var/lib/freeswitch/maskara-audio

ENTRYPOINT ["/maskara-entrypoint.sh"]
