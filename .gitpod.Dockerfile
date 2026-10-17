FROM gitpod/workspace-full-vnc

USER root

# Install dependencies
RUN apt-get update                                            \
    && apt-get install -y firefox

USER gitpod

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/home/gitpod/.bun/bin:$PATH"
