FROM docker.elastic.co/beats/filebeat:7.15.1
USER root

# Remove all unused modules
RUN cd /usr/share/filebeat/modules.d && mv gcp.yml.disabled gcp.yml
RUN rm /usr/share/filebeat/modules.d/*.disabled
RUN cd /usr/share/filebeat/module/ && find . ! -name 'gcp' ! -name '.' ! -name '..' -type d -maxdepth 1 -exec rm -rf {} +

# Removing the audit gcp module from the base image
RUN rm -rf /usr/share/filebeat/module/gcp/audit

# Copying new module files into image
COPY x-pack/filebeat/module/gcp/audit /usr/share/filebeat/module/gcp/audit

# Copying scoped fields
COPY ravelin/fields.yml fields.yml
USER filebeat
