import React from "react";
import { courses } from "../data/courses";

const Courses: React.FC = () => {
    return (
        <div className="container mx-auto px-4 py-12">
            <header className="mb-12 text-center">
                <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gradient">
                    Course Catalog
                </h1>
                <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                    Explore our expert-led learning tracks and master the future of Web3, DeFi, and Smart Contracts.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                {courses.map((course, index) => (
                    <div
                        key={index}
                        className="glass-card p-6 rounded-2xl flex flex-col h-full border border-white/10 hover:border-white/20 transition-all duration-300 group"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-brand-blue/20 text-brand-cyan border border-brand-cyan/20">
                                {course.track}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${course.level === "Beginner"
                                    ? "bg-brand-emerald/20 text-brand-emerald border-brand-emerald/20"
                                    : course.level === "Intermediate"
                                        ? "bg-brand-purple/20 text-brand-purple border-brand-purple/20"
                                        : "bg-red-500/20 text-red-400 border-red-500/20"
                                } border`}>
                                {course.level}
                            </span>
                        </div>

                        <h3 className="text-xl font-bold mb-2 group-hover:text-brand-cyan transition-colors duration-300">
                            {course.title}
                        </h3>

                        <div className="flex items-center text-gray-400 text-sm mb-6">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {course.duration}
                        </div>

                        <div className="mt-auto">
                            <button
                                disabled
                                className="w-full py-3 px-4 rounded-xl bg-white/5 border border-white/10 text-gray-500 font-semibold cursor-not-allowed hover:bg-white/10 transition-colors duration-300"
                            >
                                Coming Soon
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Courses;
