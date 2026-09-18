import os, re
p = os.path.expanduser('~/orionx_stripe.env')
k = ''
for line in open(p, encoding='utf-8', errors='replace'):
    line = line.strip()
    if line.startswith('STRIPE_SECRET_KEY='):
        k = line.split('=', 1)[1].strip().strip('"').strip("'").strip()
        break
print('prefix:', k[:10])
print('lengte:', len(k))
print('laatste4:', k[-4:])
if k.startswith('sk_live_'):
    print('MODE: LIVE')
elif k.startswith('sk_test_'):
    print('MODE: TEST')
else:
    print('MODE: ONBEKEND')
print('bevat ellipsis:', '…' in k)
print('bevat spatie:', ' ' in k)
print('regex ok:', bool(re.fullmatch(r'[A-Za-z0-9_]+', k)))
