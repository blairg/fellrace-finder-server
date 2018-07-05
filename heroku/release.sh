
 HEROKU_DOCKER_IMAGE_URL=registry.heroku.com/fellrace-finder-server/web
 docker_image_id=$(docker inspect $HEROKU_DOCKER_IMAGE_URL:latest --format={{.Id}})
 data='{"updates": [{"type": "web", "docker_image": "'$docker_image_id'"}]}'
 
 curl -k -n -X PATCH https://api.heroku.com/apps/fellrace-finder-server/formation \
    -d "$data" \
    -H "Authorization: Bearer $HEROKU_API_KEY" \
    -H "Content-Type: application/json" \
    -H "Accept: application/vnd.heroku+json; version=3.docker-releases"