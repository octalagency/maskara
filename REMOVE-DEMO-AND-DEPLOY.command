#!/bin/bash
set -e
cd "$(dirname "$0")"
export MASKARA_SSH_PASSWORD="${MASKARA_SSH_PASSWORD:-}"

echo "=== 1) Local demo fallback already removed in frontend ==="
echo "=== 2) Deploy to VPS ==="

if [ -z "$MASKARA_SSH_PASSWORD" ]; then
  echo "Password লাগবে। চালান:"
  echo "  export MASKARA_SSH_PASSWORD='YOUR_VPS_PASSWORD'"
  echo "  ./REMOVE-DEMO-AND-DEPLOY.command"
  read -s -p "অথবা এখন VPS password লিখুন: " MASKARA_SSH_PASSWORD
  echo
  export MASKARA_SSH_PASSWORD
fi

expect << EXP
set timeout 7200
set pass \$env(MASKARA_SSH_PASSWORD)
set host "148.135.137.47"
set user "root"
set local "/Users/tudo/maskara"

puts "=== rsync ==="
spawn rsync -avz -e "ssh -o StrictHostKeyChecking=accept-new" --exclude node_modules --exclude .git --exclude .next --exclude dist --exclude .env --exclude .tools \$local/ \$user@\$host:/opt/maskara/
expect {
  "yes/no" { send "yes\r"; exp_continue }
  -re "(?i)password:" { send "\$pass\r" }
}
expect eof

puts "=== remote rebuild frontend ==="
spawn ssh -o StrictHostKeyChecking=accept-new \$user@\$host
expect {
  "yes/no" { send "yes\r"; exp_continue }
  -re "(?i)password:" { send "\$pass\r" }
}
expect "# "
send "cd /opt/maskara && docker compose -f docker-compose.hostinger.yml up -d --build frontend 2>&1 | tail -40\r"
expect -timeout 3600 "# "
send "docker exec maskara-backend node -e \"const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); (async()=>{const d=await p.merchant.findFirst({where:{OR:[{slug:'demo-store'},{email:'demo@store.com'}]}}); if(d){ await p.billingRecord.deleteMany({where:{merchantId:d.id}}).catch(()=>{}); await p.call.deleteMany({where:{merchantId:d.id}}).catch(()=>{}); await p.order.deleteMany({where:{merchantId:d.id}}).catch(()=>{}); await p.apiKey.deleteMany({where:{merchantId:d.id}}).catch(()=>{}); await p.subscription.deleteMany({where:{merchantId:d.id}}).catch(()=>{}); await p.user.deleteMany({where:{merchantId:d.id}}); await p.merchant.delete({where:{id:d.id}}); console.log('demo merchant removed'); } else console.log('no demo merchant'); await p.\\\$disconnect(); })().catch(e=>{console.error(e); process.exit(1);});\"\r"
expect -timeout 120 "# "
send "docker compose -f docker-compose.hostinger.yml ps\r"
expect "# "
send "exit\r"
expect eof
puts "DONE -> https://app.maskara.bd/dashboard/orders (hard refresh Cmd+Shift+R)"
EXP
