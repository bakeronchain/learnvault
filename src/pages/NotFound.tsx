import { Button, Icon } from "@stellar/design-system"
import { Link } from "react-router-dom"
import styles from "./NotFound.module.css"

const NotFound: React.FC = () => {
	return (
		<div className={styles.container}>
			<div className={styles.content}>
				<div className={styles.iconWrapper}>
					<Icon.SearchLg size="xl" />
				</div>
				<h1 className={styles.heading}>404</h1>
				<p className={styles.message}>
					This page doesn't exist — but your learning journey does.
				</p>
				<Link to="/" className={styles.buttonLink}>
					<Button size="md" variant="primary">
						Go Home
					</Button>
				</Link>
			</div>
		</div>
	)
}

export default NotFound
