FROM node:24-alpine
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3100
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node . .
RUN mkdir -p /app/.auth && chown node:node /app/.auth && chmod 700 /app/.auth
ENV BAILEYS_AUTH_FILE=/app/.auth/session.sqlite
VOLUME ["/app/.auth"]
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:3100/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "index.js"]
