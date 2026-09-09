-- Seeds one fully-populated example property: the real GoStops Auroville
-- hostel layout from the spec. This exists so there's always at least one
-- rich, ready-to-use property in the library — a host can start a hunt
-- against it immediately, or use it as a reference for how much detail a
-- good property mapping has. Every location below has a host_description
-- detailed enough to write clues from even without a reference photo
-- (reference_image_url is left null — AI must ground clues in the host's
-- own words when no photo exists, same rule as "never invent features a
-- photo doesn't show," just applied to text instead of vision).

do $$
declare
  v_property_id uuid;
begin
  insert into properties (name, description)
  values (
    'GoStops Auroville',
    'The original demo property — a real GoStops hostel in Auroville, mapped with its common areas, dorms, and outdoor spaces. Reuse this to run a hunt immediately without mapping your own property first.'
  )
  returning id into v_property_id;

  insert into property_locations (property_id, name, floor, area, host_description, tags, safe_for_game) values
  (v_property_id, 'Front Gate', 'Ground Floor', 'Entrance',
    'The main entrance to the property from the street — a gated opening travelers pass through when arriving or leaving. Distinct from the Back Gate, which exits a different direction.',
    array['gate','entrance','street','arrival'], true),

  (v_property_id, 'Reception', 'Ground Floor', 'Entrance',
    'The front desk just inside the entrance, where guests check in. A daily activity whiteboard and posters hang on the wall directly behind the desk.',
    array['desk','whiteboard','posters','check-in'], true),

  (v_property_id, 'Activity Whiteboards', 'Ground Floor', 'Common Area',
    'A set of whiteboards near reception listing the day''s activities, events, and announcements — the handwritten content changes daily.',
    array['whiteboard','schedule','announcements'], true),

  (v_property_id, 'Six-seat Table/Chair Area', 'Ground Floor', 'Common Area',
    'A communal table with six chairs where guests sit to eat, work, or chat, in the main common area.',
    array['table','chairs','seating','communal'], true),

  (v_property_id, 'Foosball', 'Ground Floor', 'Common Area',
    'A foosball table in the common area — two rows of small figures mounted on rods that spin to kick a small ball, played by rotating the handles rather than walking.',
    array['foosball','table','game','rods','ball'], true),

  (v_property_id, 'Bookshelf', 'Ground Floor', 'Common Area',
    'A shelf of paperback books left behind by past travelers, free for any guest to borrow or swap.',
    array['books','shelf','reading'], true),

  (v_property_id, 'Board Games Shelf', 'Ground Floor', 'Common Area',
    'A shelf stacked with board games and card games available for guests to play in the common area.',
    array['board games','cards','shelf'], true),

  (v_property_id, 'Table Tennis', 'Ground Floor', 'Common Area',
    'A table tennis table in the common area, complete with net, paddles, and balls for guests to play.',
    array['table tennis','ping pong','paddles','net'], true),

  (v_property_id, 'Ice Cream Refrigerator', 'Ground Floor', 'Common Area',
    'A dedicated freezer stocked only with ice cream for purchase — distinct from the separate Cold Drinks Refrigerator nearby, which holds beverages instead.',
    array['fridge','freezer','ice cream'], true),

  (v_property_id, 'Cold Drinks Refrigerator', 'Ground Floor', 'Common Area',
    'A refrigerator stocked with bottled and canned cold drinks for purchase — distinct from the separate Ice Cream Refrigerator nearby, which holds only ice cream.',
    array['fridge','drinks','beverages'], true),

  (v_property_id, 'Theatre', 'Ground Floor', 'Common Area',
    'A small indoor theatre/screening room with a projector and speaker setup, used for movie nights and group screenings.',
    array['theatre','projector','screen','speakers'], true),

  (v_property_id, 'Private Room 1', 'Ground Floor', 'Rooms',
    'A private guest room. May be occupied — do not enter or search guest belongings.',
    array['private room','guest room'], false),

  (v_property_id, 'Private Room 2', 'Ground Floor', 'Rooms',
    'A private guest room. May be occupied — do not enter or search guest belongings.',
    array['private room','guest room'], false),

  (v_property_id, 'Private Room 3', 'Ground Floor', 'Rooms',
    'A private guest room. May be occupied — do not enter or search guest belongings.',
    array['private room','guest room'], false),

  (v_property_id, 'Private Room 4', 'Ground Floor', 'Rooms',
    'A private guest room. May be occupied — do not enter or search guest belongings.',
    array['private room','guest room'], false),

  (v_property_id, 'Back Gate', 'Ground Floor', 'Entrance',
    'A second gated exit on the opposite side of the property from the Front Gate, facing a different street.',
    array['gate','exit','street'], true),

  (v_property_id, 'Female Dorm', 'First Floor', 'Dorms',
    'A women-only shared dormitory room upstairs. May have guests resting — do not enter or search belongings.',
    array['dorm','female only','beds'], false),

  (v_property_id, '12-bed Mixed Dorm A', 'First Floor', 'Dorms',
    'A large mixed-gender dormitory with twelve beds. May have guests resting — do not enter or search belongings.',
    array['dorm','12 beds','mixed'], false),

  (v_property_id, '12-bed Mixed Dorm B', 'First Floor', 'Dorms',
    'A second large mixed-gender dormitory with twelve beds, distinct from Dorm A. May have guests resting — do not enter or search belongings.',
    array['dorm','12 beds','mixed'], false),

  (v_property_id, '4-bed Mixed Dorm A', 'First Floor', 'Dorms',
    'A small mixed-gender dormitory with four beds. May have guests resting — do not enter or search belongings.',
    array['dorm','4 beds','mixed'], false),

  (v_property_id, '4-bed Mixed Dorm B', 'First Floor', 'Dorms',
    'A second small mixed-gender dormitory with four beds, distinct from Dorm A. May have guests resting — do not enter or search belongings.',
    array['dorm','4 beds','mixed'], false),

  (v_property_id, 'External Spiral Staircase', 'External / Upper Area', 'Exterior',
    'An outdoor spiral staircase winding upward on the outside of the building — it never goes in a straight line, only up, connecting the ground floor to the terrace.',
    array['staircase','spiral','outdoor','stairs'], true),

  (v_property_id, 'Terrace', 'External / Upper Area', 'Exterior',
    'An open-air rooftop terrace reached via the external spiral staircase — the highest point on the property, used for relaxing and watching the sky.',
    array['terrace','rooftop','outdoor','high'], true),

  (v_property_id, 'Terrace Common Washroom', 'External / Upper Area', 'Exterior',
    'A shared washroom on the terrace level. Usable as a clue destination as long as it does not interfere with guests using it.',
    array['washroom','terrace','shared'], true);
end $$;
