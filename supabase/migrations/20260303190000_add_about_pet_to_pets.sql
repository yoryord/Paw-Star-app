-- Migration: add_about_pet_to_pets
-- Adds a free-text "about_pet" column to the pets table

ALTER TABLE public.pets ADD COLUMN about_pet TEXT;
