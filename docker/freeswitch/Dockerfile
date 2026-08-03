FROM safarov/freeswitch:latest

# Overlay Maskara dialer pieces onto stock FreeSWITCH (keep stock modules)
COPY conf/autoload_configs/event_socket.conf.xml /etc/freeswitch/autoload_configs/event_socket.conf.xml
COPY conf/dialplan/public/maskara_verify.xml /etc/freeswitch/dialplan/public/00_maskara_verify.xml
COPY scripts/verify.lua /usr/share/freeswitch/scripts/maskara/verify.lua
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh \
  && mkdir -p /var/lib/freeswitch/maskara-audio \
             /etc/freeswitch/sip_profiles/external \
             /usr/share/freeswitch/scripts/maskara

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["freeswitch", "-nonat", "-nf"]
