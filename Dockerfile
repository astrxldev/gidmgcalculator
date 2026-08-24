FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/ron-utils/package*.json ./packages/ron-utils/
COPY packages/rond/package*.json ./packages/rond/
COPY packages/tailwind-theme/package*.json ./packages/tailwind-theme/
COPY packages/gidmgcalculator/package*.json ./packages/gidmgcalculator/
RUN npm install
COPY . .
RUN cd packages/ron-utils && npm run build
RUN cd packages/rond && npm run build
RUN cd packages/gidmgcalculator && npm run build

FROM nginx:alpine
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/packages/gidmgcalculator/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
