FROM node:20-alpine
WORKDIR /home/node/app
RUN npm install y-websocket @y/websocket-server
ENV HOST=0.0.0.0
ENV PORT=1234
CMD ["npx", "y-websocket-server"]