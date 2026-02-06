import sys
import os

# Check for required modules
try:
    import jpype
    import jpype.imports
    import mpxj
except ImportError:
    sys.stderr.write("Missing required modules: jpype1, mpxj. Please install them using: pip install jpype1 mpxj\n")
    sys.exit(1)

def convert(input_file):
    try:
        # Start JVM if not already running
        if not jpype.isJVMStarted():
            # mpxj module import adds the classpath automatically
            jpype.startJVM()

        from org.mpxj.mpp import MPPReader
        from org.mpxj.mspdi import MSPDIWriter
        from java.io import File, ByteArrayOutputStream

        reader = MPPReader()
        try:
            project = reader.read(input_file)
        except Exception as e:
            sys.stderr.write(f"Failed to read MPP file: {e}\n")
            sys.exit(1)

        writer = MSPDIWriter()

        # Write to string (XML)
        # Using ByteArrayOutputStream to capture the Java output stream
        out_stream = ByteArrayOutputStream()
        writer.write(project, out_stream)

        # Print to stdout
        print(out_stream.toString())

    except Exception as e:
        sys.stderr.write(f"Conversion Error: {e}\n")
        sys.exit(1)
    finally:
        # We generally don't shut down JVM in a script that runs once,
        # but good practice if it were a service.
        pass

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: python3 convert_mpp.py <input_mpp_file>\n")
        sys.exit(1)

    input_path = sys.argv[1]
    if not os.path.exists(input_path):
        sys.stderr.write(f"File not found: {input_path}\n")
        sys.exit(1)

    convert(input_path)
