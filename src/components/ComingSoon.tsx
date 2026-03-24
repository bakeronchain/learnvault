import { Link } from "react-router-dom"

interface ComingSoonProps {
	title: string
}

export default function ComingSoon({ title }: ComingSoonProps) {
	return (
		<div className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center">
			<div className="w-20 h-20 bg-linear-to-br from-brand-cyan to-brand-blue rounded-[2rem] flex items-center justify-center font-black text-2xl shadow-2xl shadow-brand-cyan/30 mb-10">
				LV
			</div>
			<h1 className="text-5xl md:text-6xl font-black tracking-tighter text-gradient mb-6">
				{title}
			</h1>
			<p className="text-xl text-white/50 font-medium mb-8">
				Coming soon &mdash;{" "}
				<Link
					to="https://github.com/bakeronchain/learnvault/issues"
					target="_blank"
					rel="noopener noreferrer"
					className="text-brand-cyan hover:underline"
				>
					see open issues
				</Link>
			</p>
		</div>
	)
}
