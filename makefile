make install:
	# Deploy external project network
	-- docker network create goatFish_backend

	# Bring the project down
	-- cd src && docker-compose -f docker-compose.test.yml -f docker-compose.yml down

	# Build core logic
	cd src && docker-compose -f docker-compose.yml up -d --build
	
make test:
	sh ./src/init.sh

	# Download docker images
	docker pull lucasxhy/strategy_baseline:latest

	# Deploy external project network
	-- docker network create goatFish_backend
	
	# Bring the project down
	-- cd src && docker-compose -f docker-compose.test.yml down

	# Build core logic
	cd src && docker-compose -f docker-compose.test.yml up -d --build

	# Follow the progress of the test
	docker logs test -f

duke-nukem:
	- docker kill $$(docker ps -q)
	- docker rm $$(docker ps -a -q)
	- docker rmi $$(docker images -q)
	- docker volume prune