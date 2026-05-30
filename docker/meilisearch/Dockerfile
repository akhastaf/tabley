FROM getmeili/meilisearch:v1.12

ENV MEILI_ENV=production
ENV MEILI_NO_ANALYTICS=true
ENV MEILI_HTTP_ADDR=0.0.0.0:7700

EXPOSE 7700

# Persistence is handled by the Railway Volume attached at /meili_data in the
# service settings (Volumes tab → mount path `/meili_data`). Railway rejects
# Dockerfile `VOLUME` directives, so we don't declare one here — the data
# directory is just a regular path that the attached volume mounts onto.

ENTRYPOINT ["tini", "--"]
CMD ["/bin/meilisearch"]
