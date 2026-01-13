-- Fix signup race condition: Move role assignment to database trigger
-- This ensures atomic role assignment based on company membership

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_is_first_user BOOLEAN;
BEGIN
  -- Get company_id from metadata if provided
  v_company_id := (NEW.raw_user_meta_data ->> 'company_id')::UUID;
  
  -- Insert profile with company_id
  INSERT INTO public.profiles (id, email, full_name, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    v_company_id
  );
  
  -- Determine role based on company membership
  IF v_company_id IS NOT NULL THEN
    -- Check if this is the first user in the company
    SELECT COUNT(*) = 1 INTO v_is_first_user
    FROM public.profiles
    WHERE company_id = v_company_id;
    
    -- First user gets owner role, others get member
    IF v_is_first_user THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'owner');
    ELSE
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'member');
    END IF;
  ELSE
    -- No company, assign member role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'member');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add explicit DENY policies for user_roles modifications (defense in depth)
CREATE POLICY "Deny unauthorized role inserts"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "Deny unauthorized role updates"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (false);

CREATE POLICY "Deny unauthorized role deletes"
ON public.user_roles
FOR DELETE
TO authenticated
USING (false);

-- Ensure anon users cannot access profiles at all
CREATE POLICY "Deny anon access to profiles"
ON public.profiles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);