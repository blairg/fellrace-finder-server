        dcb
        docker tag koa2-typescript-boilerplate_api registry.heroku.com/fellrace-finder-server/web
        docker tag koa2-typescript-boilerplate_api registry.heroku.com/fellrace-finder-server/web:latest

docker login --username=_ --password=<API_KEY> registry.heroku.com     

# Change Key in release.sh file

docker build -t registry.heroku.com/fellrace-finder-server/web:latest . && \
docker push registry.heroku.com/fellrace-finder-server/web:latest && \
sh ./heroku/release.sh


## Terraform Deploy

source .env &&  terraform plan -var-file=variables.tfvars -out=tfplan -input=false && terraform apply "tfplan"