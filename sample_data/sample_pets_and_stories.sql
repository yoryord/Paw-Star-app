-- Sample data for Paw Star
-- Created: 2026-03-01
-- Purpose: Local/manual seed script for demo content
-- Note: This file is intentionally separate from migrations and should be run manually when needed.

begin;

-- Optional safety checks: ensure all required accounts exist.
do $$
declare
  missing_emails text;
begin
  select string_agg(req.email, ', ')
  into missing_emails
  from (
    values
      ('michal2026@gmail.com'::text),
      ('rosasmith@yahoo.com'::text),
      ('maria_ivanova@abv.bg'::text)
  ) as req(email)
  where not exists (
    select 1
    from auth.users u
    where u.email = req.email
  );

  if missing_emails is not null then
    raise exception 'Missing auth.users accounts for: %', missing_emails;
  end if;
end
$$;

with target_users as (
  select u.id, u.email
  from auth.users u
  where u.email in (
    'michal2026@gmail.com',
    'rosasmith@yahoo.com',
    'maria_ivanova@abv.bg'
  )
),
new_pets as (
  insert into public.pets (
    owner_id,
    name,
    species,
    breed,
    birthdate,
    birth_place,
    current_location_city,
    current_location_country
  )
  values
    (
      (select id from target_users where email = 'michal2026@gmail.com'),
      'Zara',
      'dog',
      'Golden Retriever',
      '2021-05-14',
      'Plovdiv',
      'Sofia',
      'Bulgaria'
    ),
    (
      (select id from target_users where email = 'michal2026@gmail.com'),
      'Nox',
      'cat',
      'Maine Coon',
      '2022-09-03',
      'Varna',
      'Sofia',
      'Bulgaria'
    ),
    (
      (select id from target_users where email = 'rosasmith@yahoo.com'),
      'Biscuit',
      'dog',
      'Beagle',
      '2020-11-21',
      'Austin',
      'Dallas',
      'USA'
    ),
    (
      (select id from target_users where email = 'rosasmith@yahoo.com'),
      'Milo',
      'cat',
      'British Shorthair',
      '2023-02-10',
      'Houston',
      'Dallas',
      'USA'
    ),
    (
      (select id from target_users where email = 'rosasmith@yahoo.com'),
      'Juniper',
      'dog',
      'Border Collie',
      '2021-08-30',
      'San Antonio',
      'Dallas',
      'USA'
    ),
    (
      (select id from target_users where email = 'maria_ivanova@abv.bg'),
      'Snejka',
      'cat',
      'Siberian',
      '2019-12-01',
      'Ruse',
      'Sofia',
      'Bulgaria'
    ),
    (
      (select id from target_users where email = 'maria_ivanova@abv.bg'),
      'Rex',
      'dog',
      'German Shepherd',
      '2020-04-17',
      'Pleven',
      'Sofia',
      'Bulgaria'
    ),
    (
      (select id from target_users where email = 'maria_ivanova@abv.bg'),
      'Luna',
      'cat',
      'Ragdoll',
      '2022-06-25',
      'Burgas',
      'Sofia',
      'Bulgaria'
    )
  returning id, owner_id, name
)
insert into public.stories (
  owner_id,
  title,
  content,
  status
)
values
  (
    (select id from target_users where email = 'michal2026@gmail.com'),
    'Morning Trail With Zara',
    'Today Zara woke me up before sunrise with that soft whine she uses when she knows adventure is coming. We took the long trail by the river where the grass is still wet and the air smells like clean earth. At first she pulled on the leash with pure excitement, nose working like a tiny radar, but after ten minutes she settled into a steady rhythm beside me. Every few steps she looked up, almost checking if I was still there, and then gave that happy half-smile only dogs can do. We met an older couple with a tiny terrier, and Zara lowered herself politely, tail wagging in slow circles, waiting for permission before greeting.

Later we sat near the water while ducks drifted across the surface. Zara lay down with her paws crossed, calm and proud, as if she had personally organized the whole morning. I used the quiet moment to practice her recall and focus commands. She nailed each one, even with joggers and bicycles passing by. On the way home she carried a fallen stick like a trophy, refusing to let go until we reached our door. Days like this remind me that training is not only about commands. It is about trust, timing, and the joy of moving through the world together. Zara makes ordinary mornings feel like small victories.',
    'published'
  ),
  (
    (select id from target_users where email = 'michal2026@gmail.com'),
    'Nox and the Cardboard Castle',
    'Nox has expensive toys, a climbing tree, and even one of those puzzle feeders that every cat blog recommends, yet his favorite thing this week is a shipping box from a set of kitchen bowls. I cut a few windows and one doorway, then taped two smaller boxes on top, and suddenly he had a full cardboard castle. He spent most of the afternoon inside, peeking through a window with giant eyes, then vanishing before I could take a picture. Every sound from the hallway became a "threat" to investigate, and each investigation ended with a dramatic pounce on absolutely nothing.

By evening he upgraded the game by dragging one of my socks into the castle. That sock became both treasure and enemy, depending on his mood. At one point he batted it from the second floor to the first, sprinted downstairs, and celebrated the "rescue" with a proud chirp. I sat on the floor nearby and read while he ran his little kingdom. Between missions, he would step out, rub against my leg, and head back in like a manager doing rounds. Nox can turn any corner of the apartment into a story. Watching him reminds me that enrichment does not need to be complicated. A safe space, a bit of imagination, and shared attention can make a cat feel curious, confident, and completely at home.',
    'published'
  ),
  (
    (select id from target_users where email = 'rosasmith@yahoo.com'),
    'Biscuit Learns the Beach Rules',
    'This weekend I took Biscuit to the dog-friendly beach for the first time this season. The moment his paws touched the sand, he transformed from sleepy car passenger into full explorer mode. He zigzagged between footprints, sniffed every driftwood branch, and barked once at a seagull that looked mildly offended. I kept him on a long line at first, practicing check-ins and rewarding him whenever he turned back to me on his own. It took a few tries, but he quickly understood that staying connected meant more freedom.

The real test came when we reached the waterline. Biscuit loves puddles but was suspicious of waves. He approached one brave step at a time, retreated, then tried again. After ten minutes he started splashing with his front paws like he was testing the ocean for quality control. Another beagle joined us, and the two of them began a gentle chase game, running in loops and then pausing together to inspect the same mysterious shell. Their energy was contagious, and everyone nearby started smiling.

Before leaving, we worked on a calm settle under the shade of a beach umbrella. Biscuit lay down, sandy and happy, with his chin on my shoe. The ride home was quiet except for his little snores. I think he learned three beach rules in one day: come back when called, respect the waves, and never ignore a good stick.',
    'published'
  ),
  (
    (select id from target_users where email = 'rosasmith@yahoo.com'),
    'Milo Discovers Window TV',
    'Milo has recently become obsessed with what I call "window TV". Every evening around six, he jumps to the same windowsill, curls his tail around his paws, and watches the neighborhood like a tiny detective on duty. At first it was mostly birds on the fence, but now he tracks everything: cyclists, delivery vans, children playing basketball, and even shadows moving across the parking lot. His ears rotate independently, and his whiskers push forward whenever something truly important appears.

Yesterday I added a soft blanket to the sill and moved a small lamp so the reflection on the glass would not distract him. The improvement was immediate. He stayed there for almost an hour, occasionally chirping at a sparrow that kept returning to the same branch. When the bird flew away, Milo did a dramatic flop and stared at me as if I had personally ended the show. I handed him a treat puzzle, and he solved it in record time, then returned to his post for the night shift.

What I love most is how this routine has made him more relaxed overall. He plays hard in short bursts, then settles peacefully after his evening watch. It feels like he has a job, a schedule, and a sense of territory without stress. Window TV might look simple, but for Milo it is enrichment, confidence, and entertainment all in one frame.',
    'published'
  ),
  (
    (select id from target_users where email = 'maria_ivanova@abv.bg'),
    'Rex on Rainy Day Patrol',
    'It rained all morning, which usually means canceled plans, but Rex treated the weather like a special assignment. We put on his waterproof coat and headed to the nearby park where the paths were empty and shiny from the drizzle. Instead of rushing, he moved with careful focus, sniffing each corner and checking every bench as if he were conducting an official inspection. Rain seems to sharpen his senses. He catches scents I cannot even imagine and then looks back at me with that serious, "mission continues" expression.

Halfway through our walk we practiced heel work under a row of trees. Water dripped from the leaves, and distant traffic hummed, but Rex stayed locked in. I rewarded him often, keeping sessions short and upbeat. Then we switched to a simple game of find-it with treats hidden near a low wall. He searched patiently, nose down, tail steady, and celebrated each find with a little hop. Even soaked, he radiated satisfaction.

Back home I dried him off and gave him a chew while I made tea. He settled on his mat, eyes half closed, breathing slowly. Rainy days used to frustrate me because I thought we needed perfect conditions for good training. Rex keeps proving the opposite. With clear structure and a bit of creativity, even gray weather can become the best kind of practice: quiet, focused, and full of teamwork.',
    'published'
  ),
  (
    (select id from target_users where email = 'maria_ivanova@abv.bg'),
    'Luna and Snejka Share the Sunspot',
    'Late winter sunlight reached the living room floor today, and both Luna and Snejka noticed the warm patch at exactly the same time. What followed was a silent negotiation worthy of a diplomatic summit. Luna arrived first and stretched like liquid across the center of the sunspot, while Snejka circled twice, pretending not to care. After a minute, Snejka sat down just outside the light and watched with narrowed eyes. I expected a dramatic chase, but instead Luna shifted a little, leaving just enough room for a second cat.

Snejka accepted the invitation with great dignity and lowered herself beside Luna, tails tucked neatly. For almost twenty minutes they stayed there together, occasionally adjusting paws, blinking slowly, and listening to the afternoon sounds from the kitchen. I used the peaceful moment to brush each of them for a few minutes. Normally that can trigger competition for attention, but today they took turns surprisingly well. Luna purred through her entire session, and Snejka finished with a tiny head bump against my hand.

The calm did not last forever. A toy mouse rolled from under the sofa and restarted the usual chaos, complete with hallway sprints and ambushes behind chair legs. Still, that shared sunspot felt important. These small moments of coexistence show how their bond is growing: less rivalry, more trust, and a little bit more comfort every week in the home they both rule.',
    'published'
  );

commit;
