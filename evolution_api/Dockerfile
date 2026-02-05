# Evolution API Home Assistant Add-on
# Uses the official Evolution API Docker image as base

ARG BUILD_FROM
FROM evoapicloud/evolution-api:v2.3.7

# Labels
LABEL \
    io.hass.name="Evolution API" \
    io.hass.description="WhatsApp controller API for Home Assistant" \
    io.hass.arch="aarch64|armv7|amd64" \
    io.hass.type="addon" \
    io.hass.version="2.3.7" \
    maintainer="Robin Bakker"

# Install bashio for Home Assistant integration
RUN apk add --no-cache \
    curl \
    jq \
    bash

# Install bashio
ARG BASHIO_VERSION="0.16.2"
RUN curl -fsSL "https://github.com/hassio-addons/bashio/archive/v${BASHIO_VERSION}.tar.gz" \
    | tar -xzf - --strip-components=1 -C /usr/local/lib/ bashio-${BASHIO_VERSION}/lib \
    && ln -s /usr/local/lib/bashio.sh /usr/bin/bashio \
    && ln -s /usr/local/lib/bashio.sh /usr/local/bin/bashio

# Copy run script
COPY run.sh /run.sh
RUN chmod a+x /run.sh

# Create data directories
RUN mkdir -p /data/instances /data/store

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8080/ || exit 1

# Expose port
EXPOSE 8080

# Start using run script
CMD ["/run.sh"]
