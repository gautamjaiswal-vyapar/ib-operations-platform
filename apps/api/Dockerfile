FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm install --ignore-scripts
COPY apps/api apps/api
RUN npm run build --workspace=@ib/api
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
