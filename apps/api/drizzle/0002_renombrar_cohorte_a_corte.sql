-- La plataforma usa "Corte" en lugar de "Cohorte": se renombran las cortes ya creadas
UPDATE "cohorts" SET "name" = regexp_replace("name", '^[Cc]ohorte', 'Corte') WHERE "name" ~* '^cohorte';
