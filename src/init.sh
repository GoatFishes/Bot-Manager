#!/bin/bash

#creating .env file
touch ./src/.env
echo > ./src/.env

#getting current path
CURRENT_PATH="$PWD"
echo 'CURRENT_PATH='$CURRENT_PATH > ./src/.env
echo 'BOTSPORT=3000' >> ./src/.env
echo 'NODE_AUTH_TOKEN='$NODE_AUTH_TOKEN >> ./src/.env
echo 'API_KEY_ID='$API_KEY_ID >> ./src/.env
echo 'API_KEY_SECRET='$API_KEY_SECRET >> ./src/.env
