using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ImsaFantasy.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddClassColor : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "color",
                table: "class",
                type: "character varying(7)",
                maxLength: 7,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "color",
                table: "class");
        }
    }
}
