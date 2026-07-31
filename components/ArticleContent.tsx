import Image from "next/image";
import Link from "next/link";

type ArticleContentProps = {
  slug: string;
};

function Figure({
  src,
  alt,
  caption,
  wide = false,
}: {
  src: string;
  alt: string;
  caption?: string;
  wide?: boolean;
}) {
  return (
    <figure className="my-8">
      <div
        className={`relative overflow-hidden rounded-lg border border-racing/10 bg-white ${
          wide ? "aspect-[1366/300]" : "aspect-[16/9]"
        }`}
      >
        <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 800px, 100vw" className="object-contain" />
      </div>
      {caption && <figcaption className="mt-2 text-sm text-ink-muted">{caption}</figcaption>}
    </figure>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <aside className="my-8 border-l-4 border-gold bg-cream-dark px-5 py-4 text-sm leading-7 text-ink">
      {children}
    </aside>
  );
}

function ReverseEngineeringInlineCta() {
  return (
    <section className="my-10 border border-racing/10 bg-cream-dark p-6">
      <p className="text-xs font-semibold uppercase tracking-[2px] text-gold">Custom work quote</p>
      <h2 className="mt-2 font-display text-2xl text-racing">Need a part reverse engineered?</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted">
        Upload photos, drawings or notes through the custom work form. Add what the part does and any known sizes, then
        M-Machine can review it and come back with what is needed next.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/custom-engineering#quote-form" className="btn-primary">Get started</Link>
        <Link href="/custom-engineering/guide" className="btn-secondary">What to send</Link>
      </div>
    </section>
  );
}

const headingClass = "font-display text-2xl text-racing mt-10 mb-4";
const subheadingClass = "font-semibold text-racing mt-6 mb-2";
const paragraphClass = "text-ink-muted leading-8 mb-5";
const listClass = "list-disc space-y-2 pl-6 text-ink-muted leading-7 mb-6";

function MetalGradesArticle() {
  const grades = [
    {
      name: "EN1A, EN1A(PB), 230M07",
      image: "/articles/metal-grades/en1a.jpg",
      alt: "EN1A free-cutting steel and a machined component",
      overview:
        "A mild steel that is very easy to machine to a good surface finish. EN1A(PB) is the traditional leaded free-cutting derivative. It is commonly chosen for repetitive CNC work because it machines readily and helps extend tool life, but it has poor corrosion resistance.",
      uses: "Low-stress fittings, hubs, casings, handles, linkages and decorative components.",
      avoid:
        "Highly stressed tensile parts, bolts, studs and high-wear applications. Welding is not generally recommended for the free-cutting grades, and unprotected material rusts readily.",
      machining:
        "Very easy to turn, drill and screwcut with basic tooling. Higher surface speeds and feeds with general-purpose carbide usually produce the best finish, although HSS can also work well.",
      finishing:
        "It can be machined dry, but a suitable lubricant is normally recommended. Some cutting oils may stain the surface, so clean the finished part promptly.",
    },
    {
      name: "EN3, EN3B, 070M20",
      image: "/articles/metal-grades/en3b.jpg",
      alt: "EN3 general-purpose mild steel and a fabricated component",
      overview:
        "A general-purpose mild steel that is straightforward to weld and reasonably easy to machine. It can tear or produce a rough finish when cut without lubricant. Round and flat forms may be sold under related traditional designations.",
      uses: "Lightly stressed fixings, shafts, spacers, hubs, bushes, linkages, frames and supporting fabrications.",
      avoid:
        "Highly stressed parts and components exposed to severe tensile shock loads, where yielding, bending or fracture could occur.",
      machining:
        "Long shafts and flats can move as internal stress is released during rough machining. Leave enough stock for a separate finishing pass and choose speeds and feeds carefully to limit tearing and score marks.",
      finishing:
        "Use coolant or cutting lubricant for the best accuracy and surface finish. Allow a small finishing allowance where polishing, honing or light abrasive finishing will be required.",
    },
    {
      name: "EN8, EN8D, EN8M, 080M40, 080A42, 212A42",
      image: "/articles/metal-grades/en8d.jpg",
      alt: "EN8 medium-carbon engineering steel and a machined component",
      overview:
        "A medium-strength engineering steel with better all-round mechanical properties than mild steel. It can be through hardened and is available in standard, wear-resistant and free-cutting variants.",
      uses:
        "Hydraulic rams, key steel, medium-torque shafts, tensile fixings and gears. It is also useful where improved shock resistance, cold bending and case hardenability are required.",
      avoid:
        "Applications beyond the grade's specified tensile and impact limits. Confirm the exact condition and certification when the component is safety critical.",
      machining:
        "The material can tear on fine cuts and fine threads. Carbide inserts at a suitable medium-to-high speed generally work well, and a positive finishing cut is often better than repeated very light passes.",
      finishing:
        "Use coolant or lubricant and expect to leave a small allowance for polishing, grinding or honing where a fine running surface is needed.",
    },
    {
      name: "EN16, 605M36",
      image: "/articles/metal-grades/en16t.jpg",
      alt: "EN16 engineering steel and a high-load machined part",
      overview:
        "A medium-to-high-strength steel with many of EN8's useful characteristics, plus improved resistance to shear loading and frictional wear. It is often supplied heat treated to a specified condition while retaining machinability.",
      uses: "Shear pins, connecting rods, crossheads, pistons, high-load couplings and hubs.",
      avoid:
        "It is a strong all-round grade, but material cost and the relatively subdued polished finish should be considered where appearance or a mirror-like running surface is important.",
      machining:
        "Machining behaviour is broadly similar to EN8. Screwcutting is normally manageable, but plentiful cutting fluid helps control finish and tool life.",
      finishing:
        "Use coolant throughout and remove cutting-fluid residue after machining because some products can stain the surface.",
    },
    {
      name: "EN19, 709M40",
      image: "/articles/metal-grades/en19.jpg",
      alt: "EN19 high-strength steel and a precision machined component",
      overview:
        "A high-strength steel used where good resistance to shock loading is required. It can be machined accurately to a fine finish and may be induction hardened for selected applications.",
      uses: "Tow pins, high-load studs, gears, shafts, racks, pawls and load-bearing tie rods.",
      avoid:
        "The higher material cost and tougher machining characteristics may be unnecessary where a lower-strength grade already meets the design requirement.",
      machining:
        "Turnings can be long and wiry, especially with HSS tooling. Indexable carbide is normally the practical choice for dimensional control and chip management.",
      finishing:
        "A fine machined finish is achievable when tooling, speed and feed are set correctly, often with little additional polishing.",
    },
    {
      name: "EN24T, 817M40",
      image: "/articles/metal-grades/en24.jpg",
      alt: "EN24T high-strength heat-treated steel and tooling",
      overview:
        "A high-strength alloy steel commonly supplied in the T heat-treated condition. It combines strong mechanical properties with useful machinability and responds well to controlled hardening and tempering.",
      uses: "Punches, dies, drill bushes, bearing surfaces, high-strength shafts, gears, hubs, screws and fixings.",
      avoid:
        "Added hardness can reduce tolerance to severe shock. Heat treatment can cause cracking, distortion, scaling or dimensional growth, particularly around sharp corners and abrupt section changes.",
      machining:
        "Carbide tooling is recommended. Rough at a controlled speed with a positive feed and plenty of coolant, then use an appropriate finishing speed and feed for the required tolerance.",
      finishing:
        "A good finish is normally possible directly from carbide tooling. HSS remains useful for form tools, while hardened material may require suitable carbide, ceramic or grinding processes.",
    },
  ];

  return (
    <>
      <p className={paragraphClass}>
        These are some of the steel grades we are most often asked about. The notes below give a practical overview of
        common uses and workshop behaviour, but they are not a substitute for the designer's specification, current
        standards or a material certificate.
      </p>
      <Note>
        Grade names can cover different supply conditions and specifications. For a safety-critical component, always
        confirm the exact standard, heat-treatment condition and certification required before ordering or machining.
      </Note>
      {grades.map((grade) => (
        <section key={grade.name}>
          <h2 className={headingClass}>{grade.name}</h2>
          <Figure src={grade.image} alt={grade.alt} wide />
          <p className={paragraphClass}>{grade.overview}</p>
          <h3 className={subheadingClass}>Common uses</h3>
          <p className={paragraphClass}>{grade.uses}</p>
          <h3 className={subheadingClass}>Consider another grade when</h3>
          <p className={paragraphClass}>{grade.avoid}</p>
          <h3 className={subheadingClass}>Machining</h3>
          <p className={paragraphClass}>{grade.machining}</p>
          <h3 className={subheadingClass}>Finishing</h3>
          <p className={paragraphClass}>{grade.finishing}</p>
        </section>
      ))}
    </>
  );
}

function EnBs970Article() {
  return (
    <>
      <p className={paragraphClass}>
        Traditional EN numbers remain common on British engineering drawings and in workshops. The original EN
        designation was introduced during the Second World War to improve the standardisation and selection of steels
        for manufacturing. Although newer standards exist, familiar names such as EN8 and EN24 are still widely used.
      </p>
      <p className={paragraphClass}>
        EN numbers are useful shorthand, but they do not by themselves provide a complete chemical specification. As a
        broad workshop guide, the traditional ranges are often described as follows.
      </p>
      <h2 className={headingClass}>A broad guide to traditional EN numbers</h2>
      <ul className={listClass}>
        <li><strong>EN1 to EN3:</strong> low-carbon and general-purpose steels.</li>
        <li><strong>EN5 to EN16:</strong> medium-carbon steels with useful general strength.</li>
        <li><strong>EN19 to EN24:</strong> higher-strength steels with good hardenability.</li>
        <li><strong>EN32 to EN36:</strong> case-hardening and heat-treatable grades.</li>
        <li><strong>EN40 to EN45:</strong> spring steels whose properties depend strongly on heat treatment.</li>
        <li><strong>EN56 to EN60:</strong> traditional stainless-steel designations.</li>
      </ul>
      <p className={paragraphClass}>
        Letters may be added to indicate a heat-treatment condition or a free-cutting variation. For example, PB has
        traditionally identified a leaded free-cutting derivative.
      </p>

      <Figure
        src="/articles/en-bs970/bs970.gif"
        alt="Breakdown of a BS970 steel designation"
        caption="A BS970 designation combines steel type, supply or test condition, and average carbon content."
      />

      <h2 className={headingClass}>Reading a BS970 designation</h2>
      <p className={paragraphClass}>
        A designation such as <strong>080M40</strong> can be separated into three parts: a three-digit steel type, a
        letter, and two digits representing average carbon content.
      </p>
      <h3 className={subheadingClass}>1. Steel type</h3>
      <ul className={listClass}>
        <li><strong>000 to 199:</strong> carbon-manganese steels.</li>
        <li><strong>200 to 240:</strong> free-cutting carbon-manganese steels.</li>
        <li><strong>250 to 260:</strong> silicon-manganese spring steels.</li>
        <li><strong>300 to 499:</strong> stainless and heat-resistant steels.</li>
        <li><strong>500 to 999:</strong> alloy steels.</li>
      </ul>
      <h3 className={subheadingClass}>2. The letter</h3>
      <ul className={listClass}>
        <li><strong>A:</strong> supplied to a specified chemical composition as a batch.</li>
        <li><strong>H:</strong> a hardenability-related specification.</li>
        <li><strong>M:</strong> mechanically tested and certified against the specification.</li>
        <li><strong>S:</strong> stainless-steel grade.</li>
      </ul>
      <h3 className={subheadingClass}>3. Carbon content</h3>
      <p className={paragraphClass}>
        The final two digits indicate the average carbon content. In 080M40, the 40 represents approximately 0.40%
        carbon. In 080A15, the 15 represents approximately 0.15% carbon. This difference has a major effect on strength,
        hardenability and machining behaviour.
      </p>
      <Note>
        Traditional EN names and modern standards are not always simple one-for-one equivalents. Use the drawing,
        current specification and material certification when an exact grade is required.
      </Note>
    </>
  );
}

function HeatTreatmentArticle() {
  return (
    <>
      <p className={paragraphClass}>
        Heat treatment changes the structure and properties of steel. This introduction covers the basic hardening and
        tempering sequence commonly used for small components made from gauge plate, silver steel and O1 tool steel.
      </p>
      <Note>
        Heat treatment involves extreme temperatures, flammable materials and a serious risk of burns, fire, cracking
        and component failure. Use suitable protective equipment, ventilation and fire controls. Follow the steel
        manufacturer's current data sheet and obtain professional help where the material or component is critical.
      </Note>

      <h2 className={headingClass}>Equipment</h2>
      <ul className={listClass}>
        <li>A controlled heat source capable of reaching the temperature specified for the steel.</li>
        <li>The correct quenching medium in a suitable, stable container.</li>
        <li>Heat-resistant gloves, eye and face protection, protective clothing, boots and suitable tongs.</li>
        <li>Fire-control equipment appropriate to the heat source and quenching medium.</li>
      </ul>
      <Figure src="/articles/heat-treatment/equipment.jpg" alt="Workshop equipment used for heat treating tool steel" wide />

      <h2 className={headingClass}>Allow for movement and distortion</h2>
      <p className={paragraphClass}>
        Distortion and dimensional growth can occur during hardening. Leave a finishing allowance on accurate running
        surfaces and pay particular attention to thin webs, thin-wall tube, long unsupported sections, sharp corners and
        sudden changes in section. Uneven heating can also produce local hot spots, scaling or cracking.
      </p>

      <h2 className={headingClass}>Choosing a quenching medium</h2>
      <p className={paragraphClass}>
        Quenching rapidly cools the hot steel and locks in a hardened structure. The required medium depends on the exact
        grade, section size and geometry. A more aggressive quench can increase hardness but also increases thermal shock,
        distortion and cracking risk.
      </p>
      <ul className={listClass}>
        <li><strong>Water:</strong> a rapid quench sometimes used for suitable, relatively robust components and grades.</li>
        <li><strong>Brine:</strong> faster and more aggressive than water, with a higher risk of cracking.</li>
        <li><strong>Quenching oil:</strong> a slower quench often used to reduce cracking risk in appropriate oil-hardening steels.</li>
      </ul>
      <p className={paragraphClass}>
        Never choose a quenching medium from a generic rule alone. Check the steel supplier's data for the actual grade.
      </p>

      <h2 className={headingClass}>Basic hardening sequence</h2>
      <ol className="list-decimal space-y-3 pl-6 text-ink-muted leading-7 mb-6">
        <li>Prepare the work area, protective equipment, tongs and quench before heating begins.</li>
        <li>Pre-heat the component gradually and evenly where the grade and section require it.</li>
        <li>Raise the steel to the hardening temperature stated on its data sheet and allow the section to heat uniformly.</li>
        <li>Transfer the component promptly and safely into the specified quenching medium.</li>
        <li>Once cool, remove scale from a small area so temper colours can be seen if colour tempering is being used.</li>
        <li>Temper promptly to reduce brittleness and obtain the required balance of hardness and toughness.</li>
      </ol>

      <h2 className={headingClass}>Tempering</h2>
      <p className={paragraphClass}>
        Freshly hardened steel can be extremely brittle. Tempering reheats it to a lower controlled temperature and holds
        it long enough for the complete section to reach temperature. The selected temperature determines the final
        balance between hardness and toughness.
      </p>
      <Figure
        src="/articles/heat-treatment/tempering.jpg"
        alt="Traditional temper colours at different temperatures"
        caption="Traditional surface colours can provide a visual guide, but a controlled furnace and the grade's data sheet are more reliable."
      />
      <Figure
        src="/articles/heat-treatment/rockwell.jpg"
        alt="Example graph showing tempering temperature against Rockwell hardness"
        caption="An example of the relationship between tempering temperature and finished hardness."
      />

      <h2 className={headingClass}>Finishing after heat treatment</h2>
      <p className={paragraphClass}>
        Hardened and tempered components may be finished by grinding, honing or appropriate carbide or ceramic tooling.
        Do not attempt to machine an untempered, glass-hard component: gripping or cutting forces can cause it to crack or
        shatter. For critical parts, use a professional heat-treatment provider and verify the finished hardness.
      </p>
    </>
  );
}

function DividingHeadArticle() {
  return (
    <>
      <p className={paragraphClass}>
        A dividing head or rotary index table rotates a workpiece accurately around an additional machine axis. Typical
        jobs include milling a hexagon, drilling a pitch circle, cutting gear teeth or machining equally spaced slots.
      </p>
      <p className={paragraphClass}>
        A dividing head usually presents a horizontal axis, while a rotary table is commonly used vertically, although
        either may be mounted in other orientations when the job and equipment allow it.
      </p>

      <h2 className={headingClass}>The hole plate and dividing ratio</h2>
      <div className="grid gap-5 sm:grid-cols-2">
        <Figure src="/articles/dividing-head/hole-plate.jpg" alt="Dividing head hole plate with concentric circles of holes" />
        <Figure src="/articles/dividing-head/clock-hands.jpg" alt="Sector arms or clock hands on a dividing head" />
      </div>
      <p className={paragraphClass}>
        The hole plate contains concentric circles with different numbers of equally spaced holes. A spring-loaded index
        pin in the handle locates in those holes. The head's worm ratio is commonly 40:1, meaning 40 handle turns rotate
        the spindle through one complete revolution. Other heads may use 60:1, 80:1 or another ratio, so check the machine.
      </p>
      <p className={paragraphClass}>
        On a 40:1 head, one complete handle turn moves the spindle by 9 degrees because 360 divided by 40 equals 9.
        Fractions of a handle turn are set by moving the index pin through a known number of holes on a suitable circle.
      </p>

      <h2 className={headingClass}>Using the sector arms</h2>
      <p className={paragraphClass}>
        The two adjustable sector arms, sometimes called clock hands, remove the need to recount holes after every cut.
        Set the gap between the arms to the required number of holes, make the movement, then rotate both arms together to
        establish the next stopping point. Always approach each position from the same direction to reduce backlash error.
      </p>

      <Figure src="/articles/dividing-head/calculation.jpg" alt="Dividing-head indexing calculation guide" wide />

      <h2 className={headingClass}>Worked example: seven equal divisions</h2>
      <p className={paragraphClass}>
        Suppose a 40:1 dividing head must produce seven equally spaced slots. The handle movement per slot is the head
        ratio divided by the required divisions:
      </p>
      <div className="my-6 rounded-lg bg-racing px-6 py-5 text-center font-mono text-lg font-semibold text-cream">
        40 / 7 = 5 + 5/7 handle turns
      </div>
      <p className={paragraphClass}>
        Choose a hole circle divisible by 7. On a 21-hole circle, five sevenths of a turn equals 15 holes because
        21 x 5 / 7 = 15. The movement for every slot is therefore <strong>five complete handle turns plus 15 holes on
        the 21-hole circle</strong>.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Figure src="/articles/dividing-head/example-1.jpg" alt="First step in a seven-division calculation" />
        <Figure src="/articles/dividing-head/example-2.jpg" alt="Handle turns for a seven-division calculation" />
        <Figure src="/articles/dividing-head/example-5.jpg" alt="Final hole count for a seven-division calculation" />
      </div>
      <p className={paragraphClass}>
        Not every required division matches every available hole circle. Reduce the fractional part of the handle movement,
        then select a circle whose hole count is divisible by the fraction's denominator. If no exact circle is available,
        consult the head's manual for compound or differential indexing rather than accepting an accumulating error.
      </p>
      <Figure
        src="/articles/dividing-head/vari-drive.jpg"
        alt="Machined variable-drive component produced using indexed operations"
        caption="Accurate indexing allows repeated features to be machined evenly around a component."
      />
      <Note>
        Lock the spindle or table before cutting, unlock it before indexing, account for backlash, and verify the first
        movement before machining the remaining positions.
      </Note>
    </>
  );
}

function ReverseEngineeringWornPartsArticle() {
  return (
    <>
      <p className={paragraphClass}>
        Reverse engineering is the workshop process of turning an existing part, broken sample or worn-out original into
        a new component that can be made again. It is especially useful when a drawing no longer exists, the original
        supplier has disappeared, or the part has been modified over years of service.
      </p>
      <p className={paragraphClass}>
        The important point is that a worn part should not be copied blindly. A good replacement is based on what the
        component is meant to do, which surfaces locate it, which dimensions are critical, and which features have been
        damaged or worn away.
      </p>

      <Note>
        If a part is safety critical, carries a high load, or is used on public-road or lifting equipment, the design
        requirement must be confirmed properly. Reverse engineering can recreate geometry, but it does not replace the
        need for a suitable material specification and engineering judgement.
      </Note>

      <h2 className={headingClass}>Start With Function, Not Shape</h2>
      <p className={paragraphClass}>
        A sample tells us a lot, but not everything. Before measuring it, we want to understand what the part actually
        does. Is it a spacer, shaft, link, gear, stop, bracket, guide, bush or handle? Does it rotate, clamp, slide, carry
        shock load, locate against another component, or simply hold something in place?
      </p>
      <p className={paragraphClass}>
        That functional context decides which features matter most. A decorative outside profile may only need to look
        right, while a bearing bore, shoulder, thread, keyway or bolt pattern may need to be held much more closely.
      </p>
      <Figure
        src="/articles/reverse-engineering-worn-parts/old-and-new-threaded-parts.jpg"
        alt="A worn threaded sample next to a newly machined replacement"
        caption="A worn original can provide the basic form, but the replacement should be based on the intended fit and function."
      />

      <h2 className={headingClass}>What To Send For A Quote</h2>
      <p className={paragraphClass}>
        The best reverse engineering jobs start with clear information. You do not need a perfect drawing, but the more
        context you send, the less time is lost guessing what matters.
      </p>
      <ul className={listClass}>
        <li><strong>The original part if possible:</strong> even a damaged sample is often better than photos alone.</li>
        <li><strong>Clear photos:</strong> show every side, any wear, any mating parts and a ruler or known object for scale.</li>
        <li><strong>Critical dimensions:</strong> bores, shaft diameters, thread sizes, hole centres, thicknesses and overall length.</li>
        <li><strong>Quantity:</strong> one-off repair work and repeat batches are planned differently.</li>
        <li><strong>Material or use:</strong> tell us if it needs to be stainless, aluminium, mild steel, tool steel or a specific grade.</li>
        <li><strong>Finish:</strong> bare machined, polished, painted, plated, heat treated or supplied ready for your own finishing.</li>
      </ul>
      <ReverseEngineeringInlineCta />

      <h2 className={headingClass}>Measuring A Worn Part</h2>
      <p className={paragraphClass}>
        Wear is the awkward part. A shaft may be undersize where it runs in a bush. A hole may have opened out. A thread
        may be bruised, stretched or packed with dirt. A slot may look wide because it has been hammered by years of use.
      </p>
      <p className={paragraphClass}>
        Instead of treating every visible surface as correct, we look for reference features that are least likely to
        have moved. Shoulders, unworn ends, bolt-hole patterns, register diameters and mating components are often more
        useful than the most damaged area of the sample.
      </p>
      <Figure
        src="/articles/reverse-engineering-worn-parts/large-worn-sprocket.jpg"
        alt="A large worn steel component being assessed on a workshop bench"
        caption="Large or heavily worn parts need interpretation, not just direct measurement."
      />

      <h2 className={headingClass}>Choosing Datums And Tolerances</h2>
      <p className={paragraphClass}>
        Once the useful dimensions are known, the job needs sensible datums. A datum is the feature everything else is
        measured from. On a turned part this might be a bore or shoulder. On a plate or bracket it might be one face and
        two hole centres. On a link it may be the relationship between bores.
      </p>
      <p className={paragraphClass}>
        This matters because tolerances cost time. Holding every edge to a close tolerance is rarely useful. Holding the
        correct locating face, bore or hole pattern accurately is often the difference between a part that looks right and
        a part that actually fits.
      </p>
      <Figure
        src="/articles/reverse-engineering-worn-parts/machined-link-in-fixture.jpg"
        alt="A machined aluminium link clamped in a CNC fixture"
        caption="Good workholding keeps the important features stable while the part is machined."
      />

      <h2 className={headingClass}>Threads, Bores And Repeatable Features</h2>
      <p className={paragraphClass}>
        Threads are a common reason for remaking obsolete parts. Before cutting a new thread, the original needs to be
        identified correctly: diameter, pitch, thread form, length, handedness and whether the thread is meant to locate,
        clamp or adjust.
      </p>
      <p className={paragraphClass}>
        Bores and running fits need the same care. If the matching shaft or pin is available, measure that too. Where a
        fit has worn loose, the new part may need to return to the original intended size rather than copying the worn
        hole exactly.
      </p>
      <Figure
        src="/articles/reverse-engineering-worn-parts/thread-cutting-on-lathe.jpg"
        alt="A long threaded component being screwcut on a lathe"
        caption="For threaded parts, pitch, form and fit matter as much as the visible outside diameter."
      />

      <h2 className={headingClass}>Selecting The Material</h2>
      <p className={paragraphClass}>
        If the original material is known, include it with the enquiry. If it is not known, the application usually gives
        the best clues. A light cover, a bearing carrier, a puller screw, a pivot pin and a fabrication bracket all have
        different requirements.
      </p>
      <ul className={listClass}>
        <li><strong>Aluminium:</strong> useful for light, corrosion-resistant brackets, covers, plates and housings.</li>
        <li><strong>Mild or medium-carbon steel:</strong> common for shafts, spacers, links and general mechanical parts.</li>
        <li><strong>Alloy steels:</strong> suited to higher-strength shafts, pins, studs and stressed components.</li>
        <li><strong>Stainless steel:</strong> helpful where corrosion resistance is more important than easy machining.</li>
        <li><strong>Tool steel:</strong> used when hardness, wear resistance or heat treatment is part of the design.</li>
      </ul>
      <Figure
        src="/articles/reverse-engineering-worn-parts/finished-turned-component.jpg"
        alt="A finished machined circular component on an inspection bench"
        caption="The right material and process depend on the load, environment, finish and quantity required."
      />

      <h2 className={headingClass}>When To Improve The Original</h2>
      <p className={paragraphClass}>
        Reverse engineering does not always mean making an exact clone. Sometimes a small change improves the part while
        keeping it compatible with the machine or assembly. A radius can reduce a stress raiser, a better material can
        reduce wear, or a feature can be adjusted to make future assembly easier.
      </p>
      <p className={paragraphClass}>
        Those changes should be deliberate. If a part must match a restoration, an exact visual copy may be the priority.
        If it is hidden inside a working machine, reliability and fit may matter more than faithfully reproducing a weak
        detail from the original.
      </p>
      <Figure
        src="/articles/reverse-engineering-worn-parts/machined-plate-fixture.jpg"
        alt="A machined aluminium plate located in a fixture"
        caption="A remade component can preserve the critical fit while improving details that caused problems in service."
      />

      <h2 className={headingClass}>A Practical Checklist</h2>
      <p className={paragraphClass}>
        Before asking for a quote, use this quick checklist. It helps turn a vague request into something that can be
        priced and made with confidence.
      </p>
      <ul className={listClass}>
        <li>What does the part do?</li>
        <li>Which surfaces or holes does it locate from?</li>
        <li>Which dimensions are critical, and which are only cosmetic?</li>
        <li>Is the sample worn, bent, cracked, stretched or repaired?</li>
        <li>Do you have the mating part it fits against?</li>
        <li>Do you know the material, finish or heat treatment?</li>
        <li>How many do you need now, and might you need more later?</li>
      </ul>
      <Note>
        If you are unsure, send the photos and explain what the part is from. We can usually tell you what else we need
        before any machining starts.
      </Note>
    </>
  );
}

export default function ArticleContent({ slug }: ArticleContentProps) {
  if (slug === "reverse-engineering-worn-parts") return <ReverseEngineeringWornPartsArticle />;
  if (slug === "metal-grades-and-uses") return <MetalGradesArticle />;
  if (slug === "what-en-and-bs970-mean") return <EnBs970Article />;
  if (slug === "heat-treating-tool-steel") return <HeatTreatmentArticle />;
  if (slug === "how-to-use-a-dividing-head") return <DividingHeadArticle />;
  return null;
}
