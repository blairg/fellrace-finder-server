COUNTER=0
GET_PODS_CMD="kubectl get pods -n fellrace-finder"

until $GET_PODS_CMD | grep $APP_NAME | grep -q "Running"; do
    echo "Waiting for the Fell Race Finder Server Pods to start - try ${COUNTER}"
    sleep 2

    until $GET_PODS_CMD | grep $APP_NAME | grep -q "ImagePullBackOff"; do
        echo "Fell Race Finder Server Pods failed with error ImagePullBackOff"
        exit 1
    done

    if [[ "$COUNTER" -gt 120 ]]; then
        echo "Fell Race Finder Server Pods are taking longer than 2 minutes to start up"
        exit 1
    fi

    counter=$((COUNTER+1))
done