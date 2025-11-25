#!/bin/bash
# Wait for DNS propagation

DOMAIN="dev.vibez.now"
EXPECTED_IP="13.56.236.209"
MAX_ATTEMPTS=60
SLEEP_INTERVAL=30

echo "Waiting for DNS propagation for $DOMAIN..."
echo "Expected IP: $EXPECTED_IP"
echo "Checking every $SLEEP_INTERVAL seconds (max $MAX_ATTEMPTS attempts)..."
echo ""

for i in $(seq 1 $MAX_ATTEMPTS); do
    echo -n "Attempt $i/$MAX_ATTEMPTS: "

    # Check with Google DNS
    IP=$(dig @8.8.8.8 +short $DOMAIN | head -1)

    if [ -n "$IP" ]; then
        if [ "$IP" = "$EXPECTED_IP" ]; then
            echo "✓ SUCCESS!"
            echo ""
            echo "DNS is now propagated: $DOMAIN -> $IP"
            echo "You can now run: ./setup-ssl.sh"
            exit 0
        else
            echo "⚠ Resolves to $IP (expected $EXPECTED_IP)"
        fi
    else
        echo "✗ Not resolving yet"
    fi

    sleep $SLEEP_INTERVAL
done

echo ""
echo "DNS has not propagated after $((MAX_ATTEMPTS * SLEEP_INTERVAL / 60)) minutes."
echo "Please check your DNS configuration."
