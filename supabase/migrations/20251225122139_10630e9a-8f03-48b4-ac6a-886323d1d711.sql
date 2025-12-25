-- Allow authenticated users to create companies (needed for signup)
CREATE POLICY "Authenticated users can create companies"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow anyone to create companies during signup (before they are authenticated)
-- This is needed because the company is created before the user profile is linked
CREATE POLICY "Anyone can create companies for signup"
ON public.companies FOR INSERT
TO anon
WITH CHECK (true);