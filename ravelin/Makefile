build:
	@echo "[-] building fields.yml"
	@cd ../filebeat && mage update
	@echo "[-] filtering fields"
	@python3 filter-fields.py
	@echo "[-] building custom docker image"
	@cd .. && docker build --platform linux/amd64 -t europe-docker.pkg.dev/ravelin-builds/container/sec-tools/filebeat:8.9.0 -f ravelin/Dockerfile .

publish:
	@docker push europe-docker.pkg.dev/ravelin-builds/container/sec-tools/filebeat:8.9.0
