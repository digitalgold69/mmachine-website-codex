delete from featured_work
where
  (title = 'Aluminium bonnet scoop' and full_story like 'A customer brought us a partly-finished 1275GT%')
  or (title = 'Stainless four-branch exhaust manifold' and full_story like 'Design brief called for equal-length primaries%')
  or (title = 'Hub carrier refurbishment' and full_story like 'Badly pitted original hub carriers%')
  or (title = 'Bespoke battery tray relocation' and full_story like 'Engine bay relocation for a full race build%');
