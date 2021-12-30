FROM node:14
WORKDIR /transcribe
COPY . .
RUN npm install
EXPOSE 3000
CMD [ "node", "server.js" ]
