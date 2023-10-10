# TODO: Move to internal golang image
FROM golang:1.21.2-alpine3.18 as fields_builder
RUN apk add build-base linux-headers python3 py3-pip && \
    pip3 install --upgrade setuptools
COPY . /filebeat
WORKDIR /filebeat/ravelin
RUN sh install-mage.sh && \
    tar -zxvf mage.tar.gz && \
    chmod +x mage && \
    mv mage /usr/local/bin/mage && \
    apk add make
RUN make build

# TODO: Move to internal filebeat image
FROM docker.elastic.co/beats/filebeat:8.9.2
USER root

# Removing the audit gcp module from the base image
RUN rm -rf /usr/share/filebeat/module/gcp/audit

# Copying new module files into image
COPY x-pack/filebeat/module/gcp/audit /usr/share/filebeat/module/gcp/audit
COPY x-pack/filebeat/module/gcp/cloud_armor /usr/share/filebeat/module/gcp/cloud_armor
COPY x-pack/filebeat/module/gcp/cilium /usr/share/filebeat/module/gcp/cilium

# Copying scoped fields
COPY --from=fields_builder /filebeat/ravelin/fields.yml fields.yml
USER filebeat
