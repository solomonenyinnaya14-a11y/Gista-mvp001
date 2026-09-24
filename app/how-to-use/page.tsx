import Link from "next/link";

const steps=[
["1. Start a Post","Share a thought, story, opinion, photo or voice message. Choose a Category and publish it."],
["2. Discover Gists","Use Discover to find Gists from across Gista, Following for people you follow, or Trending for Gists marked as trending."],
["3. Join the Gist","Tap Response on a Post to write a text response or record a voice response. You can also reply to other responses."],
["4. React and save","Like a Gist, save it for later, or share it with other people."],
["5. Follow people","Follow people whose Posts you want to see in your Following feed. Follower counts are shown on profiles."],
["6. Explore Gist DNA","Open Gist DNA to see participation, responses, growth, activity and the voice/text mix."],
["7. Stay safe","Report inappropriate Gists, block users, or use Not Interested when you do not want to see a particular Gist."],
];

export default function HowToUsePage() {
  return <main className="content">
    <header className="simple-header"><Link href="/help">‹ Help Center</Link><strong>How to Use Gista</strong><span /></header>
    <section className="create-card"><h2>Gista in a few steps</h2><p>Gista is simple: <strong>Express → Discover → Join the Gist → Talk → Return.</strong></p></section>
    {steps.map(([title,body])=><section className="create-card" key={title}><h3>{title}</h3><p>{body}</p></section>)}
  </main>;
}