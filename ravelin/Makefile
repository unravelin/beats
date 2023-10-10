build:
	@echo "[-] building fields.yml"
	@cd ../filebeat && mage update
	@echo "[-] filtering fields"
	@python3 filter-fields.py
