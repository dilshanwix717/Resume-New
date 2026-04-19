# Use nginx alpine as base image
FROM nginx:alpine

# Install unzip (Alpine uses apk, not apt)
RUN apk add --no-cache unzip

# Remove default nginx static files
RUN rm -rf /usr/share/nginx/html/*

# Copy zip file into container
COPY build.zip /tmp/build.zip

# Unzip and move web-mobile content
RUN unzip /tmp/build.zip -d /tmp && \
    cp -r /tmp/build/web-mobile/* /usr/share/nginx/html/ && \
    rm -rf /tmp/build /tmp/build.zip

# Copy your custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]