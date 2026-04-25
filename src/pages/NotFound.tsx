import { Button, Icon } from "@stellar/design-system"
import { Link } from "react-router-dom"
import styles from "./NotFound.module.css"

const NotFound: React.FC = () => {
	return (
		<div className={styles.container} data-testid="not-found-page">
			<div className={styles.content}>
				<div className={styles.iconWrapper}>
					<Icon.SearchLg size="xl" />
				</div>
				<h1 className={styles.heading}>404</h1>
				<p className={styles.message}>
					This page doesn't exist — but your learning journey does.
				</p>
				<div className={styles.actions}>
					<Button
						type="button"
						size="md"
						variant="secondary"
						onClick={() => window.history.back()}
						data-testid="not-found-go-back"
					>
						Go back
					</Button>
					<Link
						to="/"
						className={styles.buttonLink}
						data-testid="not-found-go-home"
					>
						<Button size="md" variant="primary">
							Go Home
						</Button>
					</Link>
				</div>
			</div>
		</div>
	)
}

export default NotFound
