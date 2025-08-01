from main import app
from mangum import Mangum

# Create WSGI adapter for Zappa
handler = Mangum(app)

# Also create the app reference for direct use
application = app
