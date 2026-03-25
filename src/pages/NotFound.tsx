import { Button, Icon, Text } from "@stellar/design-system"
import { Link } from "react-router-dom"
import styles from "./NotFound.module.css"

const NotFound: React.FC = () => {
  return (
    <div className={styles.NotFound}>
      <Icon.SearchLg size="xl" />
      <h1>404</h1>
      <Text as="p" size="md">
        This page doesn't exist — but your learning journey does.
      </Text>
      <Link to="/" aria-label="Go back to homepage">
        <Button size="md" variant="primary">
          Go Home
        </Button>
      </Link>
    </div>
  )
}

export default NotFound
