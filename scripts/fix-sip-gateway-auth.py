#!/usr/bin/env python3
"""Rewrite FreeSWITCH gateway XML for working INVITE digest (no password logs)."""
from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    src = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/gw.xml")
    dst = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/gw-new.xml")
    realm = sys.argv[3] if len(sys.argv) > 3 else "maskara.epbx.bd"
    text = src.read_text()
    m = re.search(r'name="password"\s+value="([^"]*)"', text)
    if not m:
        print("ERROR: password param missing", file=sys.stderr)
        return 1
    pwd = m.group(1)
    dst.write_text(
        "<include>\n"
        '  <gateway name="maskara_trunk">\n'
        '    <param name="username" value="201"/>\n'
        '    <param name="auth-username" value="201"/>\n'
        f'    <param name="password" value="{pwd}"/>\n'
        f'    <param name="realm" value="{realm}"/>\n'
        '    <param name="proxy" value="maskara.epbx.bd"/>\n'
        '    <param name="register-proxy" value="maskara.epbx.bd"/>\n'
        '    <param name="register" value="true"/>\n'
        '    <param name="caller-id-in-from" value="false"/>\n'
        '    <param name="extension" value="201"/>\n'
        '    <param name="from-user" value="201"/>\n'
        '    <param name="from-domain" value="maskara.epbx.bd"/>\n'
        '    <param name="extension-in-contact" value="true"/>\n'
        '    <param name="expire-seconds" value="3600"/>\n'
        '    <param name="retry-seconds" value="30"/>\n'
        '    <param name="context" value="public"/>\n'
        "  </gateway>\n"
        "</include>\n"
    )
    print(f"ok rewritten realm={realm} password_len={len(pwd)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
