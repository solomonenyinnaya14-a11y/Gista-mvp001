import Link from "next/link";

const steps=[
["1. Create a Post","Share a thought, story, opinion, photo or voice message. Choose a Category and publish it."],
["2. Discover Posts","Use Discover to find Posts from across Gista, Following for people you follow, or Trending for Posts marked as trending."],
["3. Comment on a Post","Tap Comments on a Post to write a text comment or record a voice comment. You can also reply to other comments."],
["4. React and save","Like a Post, save it for later, or share it with other people."],
["5. Follow people","Follow people whose Posts you want to see in your Following feed. Follower counts are shown on profiles."],
["6. Explore Post DNA","Open Post DNA to see participation, comments, growth, activity and the voice/text mix."],
["7. Stay safe","Report inappropriate Posts, block users, or use Not Interested when you do not want to see a particular Post."],
];

export default function HowToUsePage() {
  return <main className="content">
    <header className="simple-header"><Link href="/help">‹ Help Center</Link><strong>How to Use Gista</strong><span /></header>
    <section className="create-card"><h2>Gista in a few steps</h2><p>Gista is simple: <strong>Express → Discover → Comment → Reply → Return.</strong></p></section>
    {steps.map(([title,body])=><section className="create-card" key={title}><h3>{title}</h3><p>{body}</p></section>)}
  </main>;
}
