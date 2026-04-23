CREATE OR REPLACE FUNCTION public.normalize_project_tags(_tags text[])
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _tag text;
  _normalized text;
  _result text[] := ARRAY[]::text[];
BEGIN
  FOREACH _tag IN ARRAY COALESCE(_tags, ARRAY[]::text[])
  LOOP
    _normalized := lower(regexp_replace(trim(_tag), '\s+', ' ', 'g'));

    IF _normalized = '' THEN
      CONTINUE;
    END IF;

    IF char_length(_normalized) > 24 THEN
      RAISE EXCEPTION 'Project tags must be 24 characters or fewer';
    END IF;

    IF NOT (_normalized = ANY(_result)) THEN
      _result := array_append(_result, _normalized);
    END IF;
  END LOOP;

  IF array_length(_result, 1) > 8 THEN
    RAISE EXCEPTION 'Projects can have at most 8 tags';
  END IF;

  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_project_inputs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.name := trim(COALESCE(NEW.name, ''));

  IF NEW.name = '' THEN
    RAISE EXCEPTION 'Project name cannot be empty';
  END IF;

  IF char_length(NEW.name) > 80 THEN
    RAISE EXCEPTION 'Project name must be 80 characters or fewer';
  END IF;

  NEW.tags := public.normalize_project_tags(NEW.tags);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_project_inputs_on_projects ON public.projects;

CREATE TRIGGER validate_project_inputs_on_projects
BEFORE INSERT OR UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.validate_project_inputs();