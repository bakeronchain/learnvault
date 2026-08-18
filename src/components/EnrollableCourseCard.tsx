import React, { useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useEnrollment } from "../hooks/useEnrollment"
import CourseCard from "./CourseCard"

type EnrollableCourseCardProps = Omit<
	React.ComponentProps<typeof CourseCard>,
	| "isEnrolled"
	| "isEnrolling"
	| "isChecking"
	| "enrollError"
	| "needsPersistence"
	| "continueHref"
	| "onEnroll"
	| "onRetryPersistence"
> & {
	onBeforeEnroll?: () => void
}

const EnrollableCourseCard: React.FC<EnrollableCourseCardProps> = ({
	id,
	onBeforeEnroll,
	...courseProps
}) => {
	const navigate = useNavigate()
	const {
		isEnrolled,
		isChecking,
		isEnrolling,
		needsPersistence,
		error,
		firstLessonPath,
		enroll,
		retryPersistence,
	} = useEnrollment(id)

	const handleEnroll = useCallback(async () => {
		onBeforeEnroll?.()
		const lessonPath = needsPersistence
			? await retryPersistence()
			: await enroll()
		if (lessonPath) {
			void navigate(lessonPath)
		}
	}, [enroll, navigate, needsPersistence, onBeforeEnroll, retryPersistence])

	return (
		<CourseCard
			id={id}
			{...courseProps}
			isEnrolled={isEnrolled}
			isChecking={isChecking}
			isEnrolling={isEnrolling}
			needsPersistence={needsPersistence}
			enrollError={error}
			continueHref={firstLessonPath}
			onEnroll={() => {
				void handleEnroll()
			}}
			onRetryPersistence={() => {
				void handleEnroll()
			}}
		/>
	)
}

export default EnrollableCourseCard
