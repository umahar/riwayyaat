BEGIN;

INSERT INTO source_alias (source_id, alias, normalized)
SELECT source_id,
       alias,
       regexp_replace(lower(alias), '[^a-z0-9\\s]', ' ', 'g')
FROM (
  VALUES
    (1, 'Bukhari'),
    (1, 'Sahih Bukhari'),
    (1, 'Sahih al Bukhari'),
    (1, 'Al Bukhari'),
    (2, 'Tirmidhi'),
    (2, 'Sunan Tirmidhi'),
    (2, 'Al Tirmidhi'),
    (3, 'Ibn Abi Shaybah'),
    (3, 'Ibn Abi Shaibah'),
    (3, 'Musannaf Ibn Abi Shaybah'),
    (3, 'Musannaf Ibn Abi Shaibah'),
    (4, 'Kitab al Zuhd'),
    (4, 'Zuhd Ibn al Mubarak'),
    (4, 'Ibn al Mubarak'),
    (5, 'Shuab al Iman'),
    (5, 'Shu''ab al Iman'),
    (6, 'Abu Dawud'),
    (6, 'Abi Dawud'),
    (6, 'Sunan Abu Dawud'),
    (6, 'Sunan Abi Dawud'),
    (6, 'Sunan Abi Dawood'),
    (7, 'Daraqutni'),
    (7, 'Sunan Daraqutni'),
    (7, 'Al Daraqutni'),
    (8, 'Mu''jam al Awsat'),
    (8, 'Mujam al Awsat'),
    (8, 'Al Mu''jam al Awsat'),
    (8, 'Al Mujam al Awsat'),
    (9, 'Ibn Hibban'),
    (9, 'Sahih Ibn Hibban'),
    (10, 'Nasa''i'),
    (10, 'Nasai'),
    (10, 'Sunan an Nasa''i'),
    (10, 'Sunan al Nasai'),
    (11, 'Sunan al Kubra'),
    (11, 'Sunan al Kubra al Bayhaqi'),
    (11, 'Bayhaqi'),
    (11, 'Al Bayhaqi'),
    (12, 'Muslim'),
    (12, 'Sahih Muslim'),
    (13, 'Ahmad'),
    (13, 'Musnad Ahmad'),
    (13, 'Ahmad ibn Hanbal'),
    (14, 'Ibn Majah'),
    (14, 'Sunan Ibn Majah'),
    (15, 'Shuab al Iman'),
    (15, 'Bayhaqi Shuab al Iman'),
    (15, 'Al Bayhaqi Shuab al Iman'),
    (16, 'Jami al Saghir'),
    (16, 'Al Jami'' al Saghir'),
    (16, 'Al Jami al Saghir'),
    (17, 'Al Majruhin'),
    (17, 'Ibn Hibban al Majruhin'),
    (17, 'Majruhin'),
    (18, 'Al Mawdu''at'),
    (18, 'Mawduat'),
    (18, 'Ibn al Jawzi al Mawduat'),
    (18, 'Ibn al Jawzi'),
    (19, 'Bazzar'),
    (19, 'Musnad al Bazzar'),
    (19, 'Musnad Bazzar'),
    (20, 'Al Ilal'),
    (20, 'Daraqutni al Ilal'),
    (20, 'Ilal Daraqutni'),
    (21, 'Al Ilal Ibn Abi Hatim'),
    (21, 'Ibn Abi Hatim'),
    (21, 'Ilal Ibn Abi Hatim'),
    (22, 'Al La''ali al Masnu''a'),
    (22, 'Laali al Masnua'),
    (22, 'Suyuti al Laali al Masnua'),
    (22, 'Suyuti')
) AS v(source_id, alias)
ON CONFLICT (source_id, normalized) DO NOTHING;

INSERT INTO narrator_alias (narrator_id, alias, normalized)
SELECT
  n.id,
  trimmed.alias,
  regexp_replace(lower(trimmed.alias), '\\s+', ' ', 'g')
FROM narrator n
CROSS JOIN LATERAL (
  SELECT trim(regexp_replace(n.name, '[^a-zA-Z0-9\\s]', ' ', 'g')) AS alias
) AS trimmed
WHERE trimmed.alias <> ''
ON CONFLICT (narrator_id, normalized) DO NOTHING;

COMMIT;
