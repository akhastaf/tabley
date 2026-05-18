FROM getmeili/meilisearch:v1.12

ENV MEILI_ENV=production
ENV MEILI_NO_ANALYTICS=true
ENV MEILI_HTTP_ADDR=0.0.0.0:7700

EXPOSE 7700

VOLUME ["/meili_data"]

ENTRYPOINT ["tini", "--"]
CMD ["/bin/meilisearch"]
