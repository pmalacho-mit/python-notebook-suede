FROM node:20-alpine
WORKDIR /home/node/app
# The server moved to @y/websocket-server, whose published dependency tree
# currently resolves to an unpublished yjs 14 prerelease. y-websocket shipped
# its own server up to 1.5, and that one still speaks to a 3.x client.
RUN npm install y-websocket@1.5.4
ENV HOST=0.0.0.0
ENV PORT=1234
CMD ["npx", "y-websocket-server"]
