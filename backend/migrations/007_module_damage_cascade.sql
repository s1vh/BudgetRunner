ALTER TABLE module_damage_events
  DROP CONSTRAINT module_damage_events_module_instance_id_fkey,
  ADD CONSTRAINT module_damage_events_module_instance_id_fkey
    FOREIGN KEY (module_instance_id) REFERENCES user_module_instances(id) ON DELETE CASCADE;
